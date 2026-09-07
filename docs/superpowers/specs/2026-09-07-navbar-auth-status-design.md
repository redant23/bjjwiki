# 네비게이션바 로그인 상태 표시 + 회원가입 유도 설계

## 배경

이전 작업(User 모델 + 관리자 권한, `docs/superpowers/specs/2026-09-06-user-model-and-admin-permissions-design.md`)에서 로그인/회원가입 API와 페이지는 만들었지만, 네비게이션바 어디에도 로그인 상태를 확인하거나 로그아웃할 수 있는 UI가 없다. 로그인 여부는 `/admin` 페이지에 들어가야만 확인 가능하다.

또한 "기술 등록" 버튼은 현재 관리자에게만 보이고, 비로그인 사용자에게는 완전히 숨겨져 있어 회원가입으로 이어지는 경로가 없다.

이번 작업의 목표는 (1) 네비게이션바에서 로그인 상태를 항상 확인할 수 있게 하고, (2) 비로그인 사용자가 "기술 등록" 버튼을 눌렀을 때 회원가입 페이지로 자연스럽게 유도하는 것이다.

**범위 밖(다음 작업으로 분리)**: 일반 유저가 기술을 등록/수정하면 관리자 승인 후 반영되는 워크플로. 이는 Technique에 버전/대기 상태 개념을 새로 설계해야 하는 별도의 큰 기능이라 이번 스펙에는 포함하지 않는다. 이번 작업에서 로그인한 일반 유저(비관리자)의 "기술 등록" 버튼 노출 여부는 **현재와 동일하게 숨김 상태를 유지**한다.

## 1. `GET /api/user/me` — 신규 API

- 로그인한 사용자 **본인**의 정보를 반환한다. 관리자 권한은 필요 없고, 로그인만 되어 있으면 된다(세션 없으면 401).
- `getServerSession(authOptions)`로 세션을 가져오고, `session.user.id`로 `User.findById()`.
- 응답에는 비밀번호를 제외한 필드만 포함: `email`, `nickname`, `role`, `level`, `stripe`, `period`, `createdAt`.
- 사용자를 찾지 못하면(계정이 DB에서 삭제된 경우 등) 404.

## 2. `/profile` — 신규 페이지

- "내 정보" 링크를 클릭하면 이동하는 읽기 전용 페이지.
- 클라이언트 컴포넌트에서 `useSession()`으로 로그인 여부를 확인하고(비로그인이면 `/auth/signin`으로 리다이렉트), `GET /api/user/me`를 호출해 닉네임/이메일/벨트등급/그랄 수/수련 시작일을 화면에 표시한다.
- 수정 기능은 없다(이번 범위 밖).

## 3. 네비게이션바 — 로그인 상태 UI

`src/components/layout/NavbarClient.tsx`에 인증 상태 섹션을 추가한다:

- **비로그인**: "로그인" 링크 (`/auth/signin`)
- **로그인 상태**: "내 정보" 링크 (`/profile`) + "로그아웃" 버튼 (`signOut({ callbackUrl: '/' })`, `next-auth/react`)
- 로딩 상태(`status === 'loading'`)일 때는 아무것도 표시하지 않는다(깜빡임 방지).

## 4. "기술 등록" 버튼 동작 변경

`NavbarClient.tsx`와 `src/app/page.tsx` 두 곳 모두 동일한 규칙을 적용한다:

| 상태 | 버튼 노출 | 클릭 시 이동 |
|---|---|---|
| 비로그인 | 보임 | `/auth/signup` |
| 로그인 + 관리자 | 보임 | `/technique/new` |
| 로그인 + 일반 유저 | **숨김** (기존과 동일, 변경 없음) | - |

- `NavbarClient.tsx`는 이미 클라이언트 컴포넌트이자 `useSession()`을 쓰므로, 버튼의 `href`를 세션 상태에 따라 `/auth/signup` 또는 `/technique/new`로 분기하고, 일반 유저일 때만 렌더링하지 않는다.
- `src/app/page.tsx`는 서버 컴포넌트로 `getServerSession(authOptions)`을 이미 쓰고 있으므로(직전 작업에서 추가), 같은 방식으로 `href`를 분기한다.

## 5. 예상 변경/신규 파일 목록

- 신규: `src/app/api/user/me/route.ts`
- 신규: `src/app/profile/page.tsx`
- 수정: `src/components/layout/NavbarClient.tsx` (로그인 상태 UI 추가 + 등록 버튼 분기)
- 수정: `src/app/page.tsx` (등록 버튼 분기)
