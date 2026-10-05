// 미완성 판정 로직 검증 (DB 불필요).
import assert from 'node:assert/strict';
import { countMarkdownHeadings, getQualityIssues } from '../src/lib/technique-quality.ts';

assert.equal(countMarkdownHeadings(''), 0);
assert.equal(countMarkdownHeadings(undefined), 0);
assert.equal(countMarkdownHeadings('## 개요\n내용\n### 진입\n#해시태그는 제목 아님\n####### 7단계는 아님'), 2);
assert.equal(countMarkdownHeadings('```\n# 코드 주석\n```\n# 진짜 제목'), 1);
assert.equal(countMarkdownHeadings('~~~\n## x\n~~~'), 0);
assert.equal(countMarkdownHeadings('## 개요\r\n## 진입\r\n## 포인트'), 3);

const full = {
  videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ' }],
  thumbnailUrl: 'https://img.youtube.com/vi/x/hqdefault.jpg',
  description: '## 개요\na\n## 진입\nb\n## 핵심 포인트\nc',
};
assert.deepEqual(getQualityIssues(full).issues, []);

// 제목 2개는 부족(경계), 3개는 통과
assert.deepEqual(getQualityIssues({ ...full, description: '## a\n## b' }).issues, ['weak_structure']);
assert.deepEqual(getQualityIssues({ ...full, description: '## a\n## b\n## c' }).issues, []);

// 빈 값/공백만 있는 값은 없는 것으로 취급
assert.deepEqual(
  getQualityIssues({ videos: [{ url: '  ' }], thumbnailUrl: ' ', description: '본문만' }).issues,
  ['no_video', 'no_thumbnail', 'weak_structure']
);
assert.deepEqual(getQualityIssues({}).issues, ['no_video', 'no_thumbnail', 'weak_structure']);
assert.equal(getQualityIssues(full).headingCount, 3);

console.log('technique-quality: all checks passed');
