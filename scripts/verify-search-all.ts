// 실제 데이터 전수 검증: 모든 기술의 name.ko / name.en / aka를 질의로 넣었을 때
// 그 기술이 최상위 점수 그룹에 드는지 확인한다.
// 사용법: node --experimental-strip-types scripts/verify-search-all.ts <http://localhost:3000 | data.json>
import fs from 'node:fs';
import {
  TIER,
  buildSearchIndex,
  normalizeSearchText,
  search,
  type SearchComboInput,
  type SearchTechniqueInput,
} from '../src/lib/search.ts';

const source = process.argv[2] ?? 'http://localhost:3000';

async function load(): Promise<{ techniques: SearchTechniqueInput[]; combos: SearchComboInput[] }> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(`${source.replace(/\/$/, '')}/api/search-index`);
    const json = await res.json();
    if (!json.success) throw new Error(`search-index 실패: ${json.error}`);
    return json.data;
  }
  const raw = JSON.parse(fs.readFileSync(source, 'utf8'));
  const id = (v: unknown) => String((v as { $oid?: string })?.$oid ?? v);
  return {
    techniques: raw.techniques.map((t: SearchTechniqueInput) => ({ ...t, _id: id(t._id) })),
    combos: (raw.combos ?? []).map((c: SearchComboInput) => ({
      ...c,
      _id: id(c._id),
      techniques: c.techniques.map(id),
    })),
  };
}

const { techniques, combos } = await load();
const index = buildSearchIndex(techniques, combos);

let total = 0;
let rankOne = 0;
const tied: string[] = [];
const failures: string[] = [];

for (const t of techniques) {
  const queries = [t.name.ko, t.name.en, ...(t.aka?.ko ?? []), ...(t.aka?.en ?? [])].filter(
    (q): q is string => !!q && normalizeSearchText(q).length > 0
  );
  for (const q of [...new Set(queries)]) {
    total++;
    const hits = search(index, q).techniques;
    const pos = hits.findIndex((h) => h.technique._id === t._id);
    if (pos === 0) {
      rankOne++;
      continue;
    }
    if (pos === -1) {
      failures.push(`"${q}" → ${t.name.ko}: 결과에 없음`);
      continue;
    }
    // 위에 있는 기술이 모두 같은 문자열을 이름/별칭으로 '정확히' 갖고 있으면 데이터 중복이다.
    const above = hits.slice(0, pos);
    if (above.every((h) => h.score <= TIER.AKA_EXACT)) {
      tied.push(
        `"${q}" → ${t.name.ko} ${pos + 1}위 (같은 이름/별칭: ${above.map((h) => `${h.technique.name.ko}[${h.score === TIER.NAME_EXACT ? '이름' : '별칭'}]`).join(', ')})`
      );
    } else {
      failures.push(
        `"${q}" → ${t.name.ko} ${pos + 1}위 (위: ${above.map((h) => `${h.technique.name.ko}[${h.score}]`).join(', ')} / 본인[${hits[pos].score}])`
      );
    }
  }
}

console.log(`기술 ${techniques.length}개, 질의 ${total}개`);
console.log(`1위: ${rankOne} · 중복 데이터로 밀림: ${tied.length} · 실패: ${failures.length}`);
if (tied.length) console.log(`\n[데이터 중복 — 같은 문자열을 이름/별칭으로 가진 기술이 여럿]\n${tied.join('\n')}`);
if (failures.length) console.log(`\n[실패]\n${failures.join('\n')}`);
if (failures.length) process.exit(1);
