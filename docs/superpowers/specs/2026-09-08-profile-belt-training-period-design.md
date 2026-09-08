# 내 정보 - 벨트 등급 / 수련 시작일 수정 기능 설계

## 배경

`User` 모델에는 이미 `level`(벨트), `stripe`(그랄), `period`(수련 시작일) 필드와 이를 읽어오는 `GET /api/user/me`가 있지만, 값을 수정할 수 있는 UI/API가 없다. 사용자가 프로필 페이지(`/profile`)에서 본인의 벨트 등급과 수련 시작일을 직접 수정할 수 있게 한다.

## 1. 데이터 모델 (`src/models/User.ts`)

현재 스키마:

```ts
stripe: { type: Number, min: 0, max: 4, default: 0 },
```

`max: 4`가 모든 벨트에 하드코딩되어 있어 블랙 벨트(0~6그랄)를 표현할 수 없다. 벨트별 최대 그랄 수에 따라 검증하는 커스텀 validator로 교체한다:

```ts
const MAX_STRIPES_BY_LEVEL: Record<IUser['level'], number> = {
  white: 4,
  blue: 4,
  purple: 4,
  brown: 4,
  black: 6,
};

stripe: {
  type: Number,
  min: 0,
  default: 0,
  validate: {
    validator: function (this: IUser, v: number) {
      return v <= MAX_STRIPES_BY_LEVEL[this.level];
    },
    message: '그랄 수가 벨트 등급의 최대치를 초과했습니다.',
  },
},
```

`MAX_STRIPES_BY_LEVEL`은 모델 파일에서 export해서 API/UI에서도 재사용한다(중복 정의 방지).

## 2. API (`src/app/api/user/me/route.ts`에 `PUT` 추가)

- 로그인 필요. 비로그인 401. (본인 정보 수정이므로 `requireAdmin()` 불필요 — `getServerSession`으로 로그인 여부만 확인)
- 요청 바디: `{ level?: string, stripe?: number, period?: string }` — 세 필드 모두 선택적(부분 업데이트), 보내지 않은 필드는 기존 값 유지.
- 검증 순서:
  1. `level`이 있으면 `'white'|'blue'|'purple'|'brown'|'black'` 중 하나인지 확인. 아니면 400.
  2. 유효 `level` 확정: 요청에 `level`이 있으면 그 값, 없으면 DB의 기존 `level`.
  3. `stripe`가 있으면 정수이고 0 이상인지 확인(아니면 400). 확정된 `level`의 `MAX_STRIPES_BY_LEVEL` 최대치를 넘으면 에러 대신 최대치로 clamp한다(클라이언트에서도 동일하게 clamp하므로 일관성 유지, 그리고 "블랙→다른 벨트로 바꿀 때 그랄이 자동 조정"되는 경우 클라이언트가 이미 clamp된 값을 보내지만, API를 직접 호출하는 경우에도 안전하도록 방어).
  4. `period`가 있으면 `"YYYY-MM-DD"` 형식의 문자열로 받아 `Date`로 변환. 파싱 실패 또는 오늘보다 미래 날짜면 400 (`수련 시작일은 오늘보다 미래일 수 없습니다.`). 빈 문자열이면 `period`를 `undefined`로 설정(미입력 상태로 되돌리기 허용).
- 업데이트 후 최신 `{ level, stripe, period }`를 반환.
- 응답 형식은 `GET`과 동일한 성공/실패 포맷(`{ success, data }` / `{ success: false, error }`)을 따른다.

## 3. UI (`src/app/profile/page.tsx`)

`src/app/technique/[...slug]/page.tsx`의 수정 모드 토글과 동일한 패턴을 적용한다.

- "벨트 등급" 항목 옆(또는 카드 우측 상단)에 연필 아이콘 버튼을 추가 — 클릭 시 벨트/그랄/수련시작일 3개 필드만 편집 폼으로 전환(닉네임/이메일은 계속 읽기 전용).
- 편집 폼 구성:
  - 벨트: `<select>` — 화이트/블루/퍼플/브라운/블랙 (`LEVEL_LABELS` 재사용).
  - 그랄: `<select>` — 옵션은 현재 폼에서 선택된 벨트가 블랙이면 0~6, 그 외에는 0~4. 벨트를 바꿔서 현재 그랄 값이 새 최대치를 넘으면 그랄 값을 자동으로 새 최대치로 clamp.
  - 수련 시작일: `<input type="date">`. 값이 없으면 빈 입력.
- 저장 버튼: `PUT /api/user/me` 호출 → 성공 시 `profile` 상태 갱신 + 편집 모드 종료. 실패 시 alert로 에러 메시지 표시(technique 페이지의 `저장 실패: ...` 패턴 재사용).
- 취소 버튼: 편집 폼을 현재 `profile` 값으로 되돌리고 편집 모드 종료(저장 안 함).
- 읽기 모드 표시 갱신:
  - 기존: `벨트 등급` 행에 `"{LEVEL_LABELS[level]} · 그랄 {stripe}개"`
  - 추가: `수련 시작일` 행 아래(또는 옆)에 기간 표기를 붙인다 — `period`가 있으면 `"{years}년차 (총 {days}일째)"`, 없으면 기존처럼 아무 표기 없음(날짜 자체가 "미입력"이므로 년차 계산 스킵).
  - 계산 로직:
    - `years = 오늘.getFullYear() - 시작일.getFullYear() + 1`
    - `days = Math.floor((오늘 자정 - 시작일 자정) / 86400000) + 1` (시작일 당일을 1일째로 카운트)
  - 순수 함수 `getTrainingDuration(period: Date): { years: number; days: number }`로 분리해서 페이지 컴포넌트 안에 둔다(재사용처가 이 페이지뿐이므로 별도 유틸 파일은 만들지 않는다).

## 4. 범위 밖

- `myCombo`, `mySkills` 등 다른 프로필 섹션은 이번 작업과 무관.
- 관리자가 다른 사용자의 벨트/그랄/수련시작일을 수정하는 기능은 포함하지 않는다(본인 수정만).
- 벨트 승급 이력(과거 승급 일자 기록 등)은 다루지 않는다 — 현재 값만 저장한다.

## 5. 예상 변경/신규 파일 목록

- 수정: `src/models/User.ts` (`stripe` validator 교체, `MAX_STRIPES_BY_LEVEL` export 추가)
- 수정: `src/app/api/user/me/route.ts` (`PUT` 핸들러 추가)
- 수정: `src/app/profile/page.tsx` (편집 모드, 수련 기간 계산/표시)
