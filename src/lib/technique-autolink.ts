export interface AutolinkTechnique {
  _id: string;
  slug: string;
  parentId?: string | null;
  pathSlugs?: string[];
  name: { ko: string; en?: string };
  aka?: { ko?: string[] };
}

interface Target {
  id: string;
  href: string;
  isCurrent: boolean;
}

export interface AutolinkIndex {
  regex: RegExp;
  targets: Map<string, Target>;
}

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

const MIN_NAME_LENGTH = 2;
const SKIP_TYPES = new Set(['link', 'linkReference', 'inlineCode', 'code', 'heading']);

const stripSpaces = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const escapeRe = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 공백을 무시하고 매칭하는 이름 사전을 만든다. 루트 카테고리(부모 없음)는 제외하며,
 * 현재 페이지 기술은 사전에 남기되 링크는 만들지 않는다(더 짧은 이름이 그 안에서 매칭되는 것을 막기 위함).
 */
export function buildAutolinkIndex(
  techniques: AutolinkTechnique[],
  currentId?: string
): AutolinkIndex | null {
  const targets = new Map<string, Target>();

  for (const t of techniques) {
    if (!t.parentId) continue;
    const target: Target = {
      id: t._id,
      href: `/technique/${[...(t.pathSlugs ?? []), t.slug].join('/')}`,
      isCurrent: t._id === currentId,
    };
    const names = [t.name.ko, ...(t.aka?.ko ?? []), t.name.en ?? ''];
    for (const name of names) {
      const key = stripSpaces(name);
      if (key.length < MIN_NAME_LENGTH || targets.has(key)) continue;
      targets.set(key, target);
    }
  }
  if (targets.size === 0) return null;

  const alternatives = [...targets.keys()]
    .sort((a, b) => b.length - a.length)
    .map((key) => [...key].map(escapeRe).join('\\s*'));
  // 영문/숫자에 붙어 있는 경우(단어 일부)는 제외. 한글은 조사가 붙으므로 경계를 두지 않는다.
  const regex = new RegExp(`(?<![A-Za-z0-9])(?:${alternatives.join('|')})(?![A-Za-z0-9])`, 'gi');
  return { regex, targets };
}

function linkifyText(text: string, index: AutolinkIndex, used: Set<string>): MdNode[] | null {
  const out: MdNode[] = [];
  let last = 0;
  index.regex.lastIndex = 0;

  for (const m of text.matchAll(index.regex)) {
    const target = index.targets.get(stripSpaces(m[0]));
    if (!target || target.isCurrent || used.has(target.id)) continue;
    used.add(target.id);
    const start = m.index ?? 0;
    if (start > last) out.push({ type: 'text', value: text.slice(last, start) });
    out.push({ type: 'link', url: target.href, children: [{ type: 'text', value: m[0] }] });
    last = start + m[0].length;
  }
  if (out.length === 0) return null;
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

function walkInline(node: MdNode, index: AutolinkIndex, used: Set<string>) {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (SKIP_TYPES.has(child.type)) {
      next.push(child);
    } else if (child.type === 'text' && child.value) {
      next.push(...(linkifyText(child.value, index, used) ?? [child]));
    } else {
      walkInline(child, index, used);
      next.push(child);
    }
  }
  node.children = next;
}

function walkBlocks(node: MdNode, index: AutolinkIndex) {
  if (SKIP_TYPES.has(node.type)) return;
  if (node.type === 'paragraph') {
    // 같은 기술은 문단(블록)당 1회만 링크
    walkInline(node, index, new Set());
    return;
  }
  node.children?.forEach((c) => walkBlocks(c, index));
}

export function remarkTechniqueLinks(index: AutolinkIndex | null) {
  return () => (tree: MdNode) => {
    if (index) walkBlocks(tree, index);
  };
}
