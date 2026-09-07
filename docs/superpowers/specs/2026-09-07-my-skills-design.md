# 내 기술(My Skills) 분류 저장 기능 설계

## 배경

`User` 모델에는 이미 `mySkills` 필드가 있지만 지금은 `ObjectId[]`(단순 기술 참조 배열)이고, 실제로 채워주는 API/UI가 없어 사실상 미사용 상태다. 사용자가 관심 있는 기술을 흥미생김/연습중/즐겨씀/나를 대표하는 기술 4단계 중 하나로 분류하고, 그와 별개로 "좋아함" 표시를 붙일 수 있게 한다.

## 1. 데이터 모델 (`src/models/User.ts`)

`mySkills: mongoose.Types.ObjectId[]`를 다음으로 교체한다:

```ts
export interface IUserSkill {
  technique: mongoose.Types.ObjectId;
  status: 'interested' | 'practicing' | 'frequently_used' | 'signature' | null;
  isFavorite: boolean;
}
```

- `status` — 흥미생김(`interested`) / 연습중(`practicing`) / 즐겨씀(`frequently_used`) / 나를 대표하는 기술(`signature`) 중 하나, 또는 아무 단계도 아닌 `null`. 기술 하나당 값은 하나뿐(상호 배타적).
- `isFavorite` — `status`와 무관한 독립 boolean. 여러 기술에 동시에 `true`일 수 있다.
- **비즈니스 규칙**: 한 사용자당 `status: 'signature'`인 항목은 최대 2개까지만 허용한다. API 레벨에서 검증한다(스키마 레벨 제약이 아님 — Mongoose 서브도큐먼트 배열에 "최대 N개" 제약을 걸기 어렵기 때문).
- 항목 식별은 `(user, technique)` 조합이며, 배열 안에서 유일해야 한다(같은 기술이 두 번 들어가지 않음) — 이것도 API 레벨에서 upsert 로직으로 보장한다.
- `status`가 `null`이고 `isFavorite`도 `false`인 항목은 "아무 의미도 없는 항목"이므로 배열에서 아예 제거한다(API에서 처리).
- 지금 `mySkills`는 실제 데이터가 전혀 없는 필드라 별도 마이그레이션 없이 스키마만 교체하면 된다.

## 2. API

### `GET /api/user/me/skills`
- 로그인 필요(관리자 불필요). 비로그인 401.
- 현재 사용자의 `mySkills` 전체를 반환하되, `technique` 필드를 `populate`해서 기술 이름/슬러그를 함께 내려준다(프로필 페이지에서 바로 렌더링할 수 있도록).
- 응답 예: `{ success: true, data: [{ technique: { _id, slug, name }, status, isFavorite }, ...] }`

### `GET /api/user/me/skills/[techniqueId]`
- 로그인 필요. 비로그인 401.
- 해당 기술에 대한 현재 사용자의 항목 하나만 반환. 항목이 없으면 `{ status: null, isFavorite: false }`를 200으로 반환한다(404가 아님 — "아직 아무 분류도 안 한 상태"는 정상 상태이지 에러가 아니다).
- 기술 상세 페이지의 분류 컨트롤이 초기 상태를 그릴 때 사용한다.

### `PUT /api/user/me/skills/[techniqueId]`
- 로그인 필요. 비로그인 401.
- 바디: `{ status?: 'interested'|'practicing'|'frequently_used'|'signature'|null, isFavorite?: boolean }` — 두 필드 모두 선택적(부분 업데이트). 보내지 않은 필드는 기존 값을 유지한다.
- `status`가 4개 값 중 하나도 아니고 `null`도 아니면 400.
- `status: 'signature'`로 설정하려는데, 이 사용자의 다른 기술 중 이미 `signature`가 2개면 400 (`나를 대표하는 기술은 최대 2개까지 지정할 수 있습니다.`).
- 업데이트 후 `status === null && isFavorite === false`가 되면 해당 항목을 배열에서 제거한다.
- 응답: 갱신된 `{ status, isFavorite }`.

## 3. UI

### 기술 상세 페이지 (`src/app/technique/[...slug]/page.tsx`)
- 새 클라이언트 컴포넌트 `src/components/technique/SkillStatusControls.tsx`를 만들어 헤더 아래(수정 모드가 아닐 때만)에 배치한다.
- 로그인하지 않았으면 아무것도 렌더링하지 않는다.
- 4개의 상태 토글 버튼(흥미생김/연습중/즐겨씀/나를 대표하는 기술) — 현재 선택된 것은 강조 표시, 다시 누르면 해제(`status: null`). 별개로 좋아요(하트) 토글 버튼 하나.
- 마운트 시 `GET /api/user/me/skills/[techniqueId]`로 초기 상태를 가져오고, 클릭 시 `PUT`으로 갱신한다.

### 프로필 페이지 (`src/app/profile/page.tsx`)
- "내 기술" 섹션을 추가한다. `GET /api/user/me/skills`로 목록을 가져와:
  - 흥미생김 / 연습중 / 즐겨씀 / 나를 대표하는 기술 4개 그룹으로 나눠 기술 이름(클릭 시 상세 페이지로 이동)을 나열.
  - `isFavorite: true`인 기술을 모아 "좋아하는 기술" 그룹도 별도로 보여준다(위 4개 그룹과 겹칠 수 있음 — 상태와 무관한 별도 축이므로).
  - 각 항목에 제거(x) 버튼을 둬서 그 축(상태 또는 좋아요)만 해제할 수 있게 한다 — `PUT`으로 해당 필드만 `null`/`false`로 보낸다.

## 4. 범위 밖

- 기술 상세 페이지의 `canEditTechnique()`가 항상 `true`를 반환하는 기존 버그(로그인 여부와 무관하게 수정/삭제 버튼이 보임)는 이번 작업과 무관하므로 손대지 않는다(별도로 플래그해둠).
- `myCombo`(콤보 등록)는 이번 스펙에 포함하지 않는다.

## 5. 예상 변경/신규 파일 목록

- 수정: `src/models/User.ts` (`mySkills` 필드 타입 교체)
- 신규: `src/app/api/user/me/skills/route.ts` (GET 목록)
- 신규: `src/app/api/user/me/skills/[techniqueId]/route.ts` (GET 단건 + PUT)
- 신규: `src/components/technique/SkillStatusControls.tsx`
- 수정: `src/app/technique/[...slug]/page.tsx` (컨트롤 삽입)
- 수정: `src/app/profile/page.tsx` ("내 기술" 섹션 추가)
