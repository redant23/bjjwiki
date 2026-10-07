import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import type { PluggableList } from 'unified';
import { cn } from '@/lib/utils';

interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

type SectionKind = 'steps' | 'warning' | 'default';

const WARNING_RE = /안전|주의|경고|위험|caution|warning|safety/i;
const STEPS_RE = /동작\s*방법|순서|단계|how\s*to|steps?/i;

function textOf(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

function classify(title: string): SectionKind {
  if (WARNING_RE.test(title)) return 'warning';
  if (STEPS_RE.test(title)) return 'steps';
  return 'default';
}

/**
 * `###` 소제목과 그 아래 내용을 <section data-kind="...">로 묶는다.
 * 첫 `###` 이전의 내용(리드 문단)은 그대로 둔다. 콘텐츠(DB)는 변경하지 않는다.
 */
function remarkSections() {
  return (tree: MdNode) => {
    const out: MdNode[] = [];
    let current: MdNode | null = null;

    for (const node of tree.children ?? []) {
      if (node.type === 'heading' && node.depth === 3) {
        current = {
          type: 'mdSection',
          children: [node],
          data: {
            hName: 'section',
            hProperties: { className: ['md-section'], 'data-kind': classify(textOf(node)) },
          },
        };
        out.push(current);
      } else if (node.type === 'heading' && (node.depth ?? 6) < 3) {
        current = null;
        out.push(node);
      } else if (current) {
        current.children!.push(node);
      } else {
        out.push(node);
      }
    }
    tree.children = out;
  };
}

type MarkdownContentProps = {
  children: string;
  components?: ComponentProps<typeof ReactMarkdown>['components'];
  className?: string;
  extraRemarkPlugins?: PluggableList;
};

export function MarkdownContent({ children, components, className, extraRemarkPlugins = [] }: MarkdownContentProps) {
  return (
    <div className={cn('md-content', className)}>
      <ReactMarkdown remarkPlugins={[remarkBreaks, remarkSections, ...extraRemarkPlugins]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
