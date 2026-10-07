// 콤보 gearType(기/노기) 판정·필터·마이그레이션 매핑 검증 (DB 불필요).
import assert from 'node:assert/strict';
import {
  comboGearLabel,
  comboMatchesType,
  gearTypeFromComboName,
  isComboGearType,
} from '../src/lib/combo-type.ts';

// 값 검증
assert.equal(isComboGearType('gi'), true);
assert.equal(isComboGearType('nogi'), true);
assert.equal(isComboGearType('both'), false);
assert.equal(isComboGearType(undefined), false);

// 라벨
assert.equal(comboGearLabel('gi'), '기');
assert.equal(comboGearLabel('nogi'), '노기');
assert.equal(comboGearLabel(undefined), '미지정');
assert.equal(comboGearLabel('weird'), '미지정');

// 필터: 구성 기술이 아니라 gearType만 본다
assert.equal(comboMatchesType('gi', 'gi'), true);
assert.equal(comboMatchesType('gi', 'nogi'), false);
assert.equal(comboMatchesType('nogi', 'nogi'), true);
assert.equal(comboMatchesType('nogi', 'gi'), false);
assert.equal(comboMatchesType('gi', 'all'), true);
assert.equal(comboMatchesType(undefined, 'all'), true); // 전체는 미지정도 보인다
assert.equal(comboMatchesType(undefined, 'gi'), false);
assert.equal(comboMatchesType(undefined, 'nogi'), false);

// 마이그레이션: 이름 말머리 → gearType
assert.equal(gearTypeFromComboName('[기] 스파이더 가드 라쏘 암바 연계'), 'gi');
assert.equal(gearTypeFromComboName('[노기] 암드래그 백 테이크 연계'), 'nogi');
assert.equal(gearTypeFromComboName('[기/노기] 하프 가드 딥 하프 스윕 연계'), 'gi'); // 공용은 gi
assert.equal(gearTypeFromComboName('[ 노기 ] 공백 허용'), 'nogi');
assert.equal(gearTypeFromComboName('  [기] 앞 공백'), 'gi');
assert.equal(gearTypeFromComboName('말머리 없는 콤보'), null);
assert.equal(gearTypeFromComboName('콤보 [노기] 중간'), null); // 맨 앞 말머리만 인정
assert.equal(gearTypeFromComboName('[기타] 모르는 말머리'), null);
assert.equal(gearTypeFromComboName(''), null);

console.log('combo-type: all checks passed');
