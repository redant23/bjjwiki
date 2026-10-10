// ⌘K 검색 정규화·랭킹·콤보 매칭 검증 (DB 불필요). 픽스처는 실제 데이터 일부를 옮겨 왔다.
import assert from 'node:assert/strict';
import {
  buildSearchIndex,
  isChosungQuery,
  normalizeSearchText,
  search,
  searchKeys,
  stripComboTag,
  toChosung,
  type SearchTechniqueInput,
} from '../src/lib/search.ts';

let n = 0;
const t = (
  ko: string,
  en: string,
  akaKo: string[] = [],
  level = 3,
  akaEn: string[] = []
): SearchTechniqueInput => ({
  _id: `t${++n}`,
  name: { ko, en },
  aka: { ko: akaKo, en: akaEn },
  slug: `t${n}`,
  pathSlugs: Array.from({ length: level - 1 }, (_, i) => `p${i}`),
  level,
});

const techniques = [
  t('암바', 'Armbar', ['Juji Gatame', '팔꺾기']),
  t('클로즈드 가드', 'Closed Guard', ['Closed Guard', '클로즈드 가드', 'Full Guard'], 2),
  t('클로즈드 가드 스윕', 'Closed Guard Sweep', [], 2),
  t('플라워 스윕', 'Flower Sweep', ['Flower Sweep', '플라워 스윕']),
  t('스퀴드 가드', 'Squid Guard', ['오징어 가드'], 4),
  t('에스티마 락', 'Estima Lock', ['Estima', '에스티마']),
  t('헬리콥터 스윕', 'Helicopter Sweep', ['헬리콥터', 'Helicopter']),
  t('본 플루 초크', 'Von Flue Choke', ['폰 플루 초크', '숄더 초크', '본 플루'], 3, ['Shoulder Choke', 'Von Flue']),
  t('에제키엘 초크', 'Ezekiel Choke', ['Ezekiel', '에제키엘', 'Sode Guruma Jime', '소데구루마지메']),
  t('트라이앵글 초크', 'Triangle Choke', ['Triangle', '트라이앵글', '삼각조르기', '산카쿠 지메']),
  t('암트라이앵글', 'Arm Triangle', ['어깨누르기']),
  t('바디 트라이앵글', 'Body Triangle', ['바디 트라이앵글 컨트롤']),
  t('힙 이스케이프', 'Hip Escape', ['Shrimp', '새우 동작', '새우 빼기'], 2),
  t('엉덩이 빼기', 'Hip Escape', ['Shrimp', '새우빼기', '힙이스케이프']),
  t('리어 네이키드 초크', 'Rear Naked Choke', ['RNC', '뒷목조르기', 'Back Choke']),
  t('X 가드', 'X Guard', ['X-Guard', 'X 가드']),
  t('싱글렉 엑스가드', 'Single Leg X Guard', ['SLX']),
  t('50/50 가드', '50/50 Guard', ['피프티 피프티']),
  t('가드 리커버리', 'Guard Recovery', ['가드 리텐션', 'Guard Retention'], 2),
  t('가드 리텐션 힙 스위치 드릴', 'Guard Retention Hip Switch Drill', [], 3),
];
const id = (ko: string) => techniques.find((x) => x.name.ko === ko)!._id;

const combos = [
  { _id: 'c1', name: '[기] 클로즈드 가드 트라이앵글 연계', techniques: [id('클로즈드 가드'), id('트라이앵글 초크')], gearType: 'gi' },
  { _id: 'c2', name: '[노기] 플라워 스윕 암바 연계', techniques: [id('플라워 스윕'), id('암바')], gearType: 'nogi' },
  { _id: 'c3', name: '[노기] 백 테이크 연계', techniques: [id('힙 이스케이프'), id('리어 네이키드 초크')], gearType: 'nogi' },
  { _id: 'c4', name: '[기] 트라이앵글 초크 피니시', techniques: [id('트라이앵글 초크'), id('암바')], gearType: 'gi' },
];

const index = buildSearchIndex(techniques, combos);
const names = (q: string) => search(index, q).techniques.map((h) => h.technique.name.ko);
const top = (q: string) => names(q)[0];
const comboIds = (q: string) => search(index, q).combos.map((h) => h.combo._id);

// 정규화
assert.equal(normalizeSearchText('50/50 가드'), '5050가드');
assert.equal(normalizeSearchText('X-Guard (Gi).'), 'xguardgi');
assert.deepEqual(searchKeys('X 가드'), ['x가드', '엑스가드']);
assert.deepEqual(searchKeys('X-Guard'), ['xguard']); // 한글이 없으면 읽기 변환 없음
assert.deepEqual(searchKeys('SLX 가드'), ['slx가드']); // 여러 글자 영문은 그대로
assert.equal(toChosung('플라워 스윕'), 'ㅍㄹㅇㅅㅇ');
assert.equal(isChosungQuery('ㅍㄹㅇ'), true);
assert.equal(isChosungQuery('플ㄹ'), false);
assert.equal(stripComboTag('[기/노기] 하프 가드 연계'), '하프 가드 연계');

// 요청된 테스트 케이스
assert.equal(top('플라워'), '플라워 스윕');
assert.deepEqual(names('플라워'), ['플라워 스윕']); // 설명 등에서 엉뚱하게 걸리던 노이즈 없음
assert.deepEqual(names('플라워스윕'), names('플라워 스윕'));
assert.equal(top('플라워스윕'), '플라워 스윕');
assert.equal(top('에스티마'), '에스티마 락');
assert.equal(top('헬리콥터'), '헬리콥터 스윕');
assert.equal(top('본플루'), '본 플루 초크');
assert.deepEqual(names('본플루'), names('본 플루'));
assert.equal(top('소데구루마지메'), '에제키엘 초크');
assert.deepEqual(names('소데 구루마 지메'), names('소데구루마지메'));
assert.deepEqual(names('새우빼기'), names('새우 빼기'));
assert.deepEqual(names('새우빼기'), ['엉덩이 빼기', '힙 이스케이프']); // 같은 별칭 → 짧은 이름 우선
assert.equal(top('rnc'), '리어 네이키드 초크');
assert.equal(top('RNC'), '리어 네이키드 초크');
assert.equal(top('triangle'), '트라이앵글 초크');
assert.equal(top('ㅍㄹㅇ'), '플라워 스윕');
assert.deepEqual(search(index, 'ㅋㅋㅋㅋ'), { techniques: [], combos: [] });

// 한글 조합 중간 상태에서도 결과가 끊기지 않는다
assert.equal(top('플ㄹ'), '플라워 스윕');
assert.equal(top('플랑'), '플라워 스윕'); // 받침으로 먼저 붙은 다음 글자 첫소리
assert.equal(top('본 플ㄹ'), '본 플루 초크');
assert.equal(top('에스팉'), '에스티마 락');
assert.equal(top('헬리콥ㅌ'), '헬리콥터 스윕');
assert.deepEqual(search(index, 'ㅏㅏ'), { techniques: [], combos: [] });
assert.deepEqual(search(index, '없는기술이름'), { techniques: [], combos: [] });
assert.deepEqual(search(index, '   '), { techniques: [], combos: [] });

// X 가드 = X가드 = 엑스가드, 50/50 = 5050
assert.equal(top('X 가드'), 'X 가드');
assert.equal(top('x가드'), 'X 가드');
assert.equal(top('엑스가드'), 'X 가드');
assert.ok(names('엑스가드').includes('싱글렉 엑스가드'));
assert.equal(top('5050'), '50/50 가드');
assert.equal(top('50 50'), '50/50 가드');

// 랭킹 등급: 이름 일치 > 별칭 일치 > 이름 접두 > 별칭 접두 > 이름 중간 > 별칭 중간
assert.deepEqual(names('트라이앵글'), ['트라이앵글 초크', '암트라이앵글', '바디 트라이앵글']); // 중간 일치끼리는 짧은 이름 우선
assert.equal(top('가드 리텐션'), '가드 리커버리'); // 별칭 완전 일치가 다른 기술 이름 접두보다 위
assert.equal(names('가드 리텐션')[1], '가드 리텐션 힙 스위치 드릴');
// 이름 접두: 같은 등급이면 짧은 이름 → 낮은 level 순
assert.deepEqual(names('클로즈드'), ['클로즈드 가드', '클로즈드 가드 스윕']);

// 콤보: 이름 매칭이 포함 기술 매칭보다 위, 말머리는 무시
assert.deepEqual(comboIds('트라이앵글'), ['c4', 'c1']); // 콤보 이름 접두 > 중간
assert.deepEqual(comboIds('triangle'), ['c1', 'c4']); // 둘 다 포함 기술(트라이앵글 초크)로 매칭
assert.equal(search(index, 'triangle').combos[0].matchedTechnique, '트라이앵글 초크');
assert.deepEqual(comboIds('트라이앵글 초크'), ['c4', 'c1']); // c4는 콤보 이름 접두 일치
assert.deepEqual(comboIds('플라워'), ['c2']);
assert.deepEqual(comboIds('백 테이크'), ['c3']);
assert.deepEqual(comboIds('rnc'), ['c3']);
assert.ok(search(index, '기').combos.every((h) => h.matchedTechnique)); // [기] 말머리로는 콤보 이름이 걸리지 않음
assert.deepEqual(comboIds('노기'), []);
assert.deepEqual(comboIds('ㅍㄹㅇ'), ['c2']);

// 500개 이상에서도 빠른지 (인덱스는 한 번, 검색은 매 입력)
const many = Array.from({ length: 1000 }, (_, i) => t(`테스트 기술 ${i}`, `Test Technique ${i}`, [`별칭 ${i}`]));
const big = buildSearchIndex([...techniques, ...many], combos);
const start = performance.now();
for (const q of ['플라워', '테스트', 'tech', 'ㅌㅅㅌ', '별칭 99']) search(big, q);
const perQuery = (performance.now() - start) / 5;
assert.ok(perQuery < 20, `검색 1회 ${perQuery.toFixed(1)}ms`);

console.log(`search: all checks passed (1,020개 기준 검색 1회 ${perQuery.toFixed(2)}ms)`);
