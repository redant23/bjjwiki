# 콤보 v2 (고유 기술 순서 + 여러 시연 + 승인제)

## 구조
- `Combo`: `number`(승인 시점 부여, 불변·재사용 없음), `techniques`(순서), `chainKey`(id를 `>`로 연결), `status`(pending/published/rejected), `publishedAt`, `demos[]`, `saveCount`. `name`/`gearType`/`videoUrl`/`photoUrl`은 레거시 보존 필드(UI 미사용).
- `ComboRequest`: 시연 추가/수정/삭제 요청과 콤보 등록 요청의 심사 큐·이력 (`create_combo | add_demo | edit_demo | delete_demo`, `pending | approved | rejected | cancelled`).
- `Counter`(`_id: 'combo'`): `findOneAndUpdate $inc`로 번호 발급.
- 모델 선택 이유: 콤보 등록은 콤보 문서 자체의 `status`로(같은 컬렉션의 부분 유니크 인덱스로 pending 중복까지 원자적으로 막고, pending 전용 주소·작성자 카드·검색 노출 제어가 단순), 시연 변경은 `ComboRequest`로(변경 전/후 비교, 반려 사유, 이력).
- 유니크 인덱스: `number`(부분: number 타입일 때), `chainKey`(부분: status ∈ pending, published). 반려/취소되면 chainKey가 풀린다.
- 승인 시 요청을 `pending→approved`로 먼저 선점(조건부 업데이트)한 뒤 번호를 발급하므로 동시/이중 승인에도 번호가 중복·소모되지 않는다.

## 권한
| 동작 | 일반 사용자 | 관리자 |
|---|---|---|
| 콤보 등록 | 요청(pending) | 즉시 공개 + 번호 |
| 시연 추가/수정/삭제 | `POST /api/combo-requests`로 요청 | 즉시 반영 |
| `POST /api/combos/:id/demos`, `PATCH/DELETE /api/combos/:id/demos/:demoId`, `PATCH/DELETE /api/combos/:id` | 403 | 허용 |

대기/반려 콤보와 요청은 작성자 본인과 관리자만 목록·검색·상세에서 볼 수 있고, 그 외에는 404다.

## 시전자(performer) 채우기: 관리자용 시연 수정 API
관리자 로그인 상태(쿠키)에서:
```
PATCH /api/combos/<번호 또는 _id>/demos/<demoId>
Content-Type: application/json
{ "performer": "케네디 마시엘" }        // 보낸 필드만 바뀐다 (videoUrl, gearType도 동일)
```
- `demoId`는 `GET /api/combos/<번호>` 응답의 `demos[]._id`.
- 시전자는 앞뒤 공백 제거·연속 공백 정리, 최대 40자. 비우려면 `"performer": ""`.
- 콤보 상세의 시연 카드에서 관리자는 [수정] 버튼으로도 바꿀 수 있다.

## 이전(마이그레이션)
- 스크립트: `scripts/combo-v2/` (`backup.ts`, `migrate.ts`, `restore.ts`, `clone-db.ts`).
```
node --experimental-strip-types scripts/combo-v2/backup.ts                 # 백업 → backups/ (git 제외)
node --experimental-strip-types scripts/combo-v2/migrate.ts                # 드라이런(대응표만)
node --experimental-strip-types scripts/combo-v2/migrate.ts --apply        # 적용 (재실행 안전: 번호 없는 문서만 처리)
node --experimental-strip-types scripts/combo-v2/restore.ts --from=backups/<폴더> --yes   # 롤백
```
- **롤백 주의**: `restore.ts`는 백업 이후 만들어진 콤보와 `comborequests`(승인 요청)를 모두 지우고 백업 시점으로 되돌린다. 새 기능 사용이 시작된 뒤에는 쓰지 말 것.
- 추가형: 기존 필드는 그대로 두므로 이전 버전 코드가 같은 DB를 읽어도 깨지지 않는다.
- 이전 코드로 배포가 늦는 동안 새로 생긴 콤보는 번호가 없다 → 배포 후 `migrate.ts --apply`를 한 번 더 실행하면 이어서 번호가 부여된다.

### 번호 ↔ 기술 순서 대응표 (createdAt 오름차순, 1~29)
| 번호 | 기술 순서 | 복장 | 영상 | 시작(초) |
|---|---|---|---|---|
| #1 | 하프 가드 → 딥 하프 가드 → 스윕 | - | 없음 |  |
| #2 | 스파이더 가드 → 라쏘 스파이더 가드 → 암바 | - | 없음 |  |
| #3 | 게이터 롤 패스 → 아나콘다 초크 | 노기 | 있음 |  |
| #4 | 우데 가에시 → 암바 | 기 | 있음 |  |
| #5 | 클로즈드 가드 → 암바 → 트라이앵글 초크 → 오모플라타 | 노기 | 있음 |  |
| #6 | 니 슬라이스 패스 → 길로틴 초크 → 아나콘다 초크 → 다스 초크 | 노기 | 있음 |  |
| #7 | 토레안도 패스 → 사이드 컨트롤 → 마운트 포지션 → 암바 | 기 | 있음 |  |
| #8 | 암드래그 → 백 테이크 | 노기 | 있음 |  |
| #9 | 프레셔 패스 → 레그위브 패스 → 마운트 포지션 → 십자조르기 | 기 | 있음 | 470s |
| #10 | 키무라 트랩 → 리버스 트라이앵글 → 암바 | 노기 | 있음 | 1679s |
| #11 | 백 테이크 → 리어 네이키드 초크 | 노기 | 있음 | 615s |
| #12 | 백 테이크 → 바디 트라이앵글 → 리어 네이키드 초크 | 노기 | 있음 | 190s |
| #13 | 시트벨트 그립 → 바디 트라이앵글 → 리어 네이키드 초크 | 노기 | 있음 | 1265s |
| #14 | 앵클 픽 → 백 테이크 → 리어 네이키드 초크 | 노기 | 있음 | 3682s |
| #15 | 아시 가라미 → 니바 → 힐 훅 | 노기 | 있음 | 750s |
| #16 | 프론트 헤드락 → 암인 길로틴 → 다스 초크 | 노기 | 있음 | 203s |
| #17 | 백 테이크 → 루오톨로틴 | 노기 | 있음 | 588s |
| #18 | 프론트 헤드락 → 길로틴 초크 | 노기 | 있음 | 3447s |
| #19 | 아시 가라미 → 힐 훅 | 노기 | 있음 | 406s |
| #20 | 힐 훅 → 백 테이크 → 리어 네이키드 초크 | 노기 | 있음 | 328s |
| #21 | 바디 트라이앵글 → 리어 네이키드 초크 → 암바 | 노기 | 있음 | 378s |
| #22 | 백 테이크 → 암바 | 노기 | 있음 | 6185s |
| #23 | 백 테이크 → 슬라이딩 칼라 초크 | 기 | 있음 | 177s |
| #24 | 토레안도 패스 → 프레셔 패스 → 남북 포지션 | 기 | 있음 | 198s |
| #25 | 사이드 컨트롤 → 암트라이앵글 → 남북 포지션 → 노스 사우스 초크 | 노기 | 있음 | 245s |
| #26 | 스탠딩 패스 → 스트레이트 앵클락 | 기 | 있음 | 74s |
| #27 | 터틀 포지션 → 백 테이크 → 슬라이딩 칼라 초크 | 기 | 있음 | 290s |
| #28 | 베어 트랩 → 힐 훅 | 노기 | 있음 | 905s |
| #29 | 아시 가라미 → 마이키락 | 노기 | 있음 | 254s |
