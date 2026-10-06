// 콤보 기/노기 판정 검증 (DB 불필요).
import assert from 'node:assert/strict';
import { comboMatchesType, comboTypeInfo, comboTypeLabel } from '../src/lib/combo-type.ts';

const info = (types: string[]) => comboTypeInfo(types);

// 전부 공용 → 어느 쪽 필터에도 포함
assert.deepEqual(info(['both', 'both']), { gi: true, nogi: true });
assert.equal(comboTypeLabel(info(['both', 'both'])), '기/노기 공용');
// 기 전용이 하나라도 있으면 노기에서는 못 한다
assert.deepEqual(info(['gi', 'both']), { gi: true, nogi: false });
assert.equal(comboTypeLabel(info(['gi', 'both'])), '기');
assert.deepEqual(info(['nogi', 'both']), { gi: false, nogi: true });
assert.equal(comboTypeLabel(info(['nogi'])), '노기');
// 기 전용 + 노기 전용 → 어느 쪽도 아님
assert.deepEqual(info(['gi', 'nogi']), { gi: false, nogi: false });
assert.equal(comboTypeLabel(info(['gi', 'nogi'])), '기/노기 혼합');
// 알 수 없는 값/빈 목록은 어느 쪽으로도 단정하지 않는다
assert.deepEqual(info(['both', 'weird']), { gi: false, nogi: false });
assert.deepEqual(info([]), { gi: false, nogi: false });

// 필터
assert.equal(comboMatchesType(info(['gi', 'both']), 'gi'), true);
assert.equal(comboMatchesType(info(['gi', 'both']), 'nogi'), false);
assert.equal(comboMatchesType(info(['gi', 'nogi']), 'all'), true); // 전체는 혼합도 보인다
assert.equal(comboMatchesType(info(['gi', 'nogi']), 'gi'), false);

console.log('combo-type: all checks passed');
