# User 모델 및 관리자 권한 시스템 설계

## 배경

현재 로그인은 `.env`의 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 값과 비교하는 데모용 NextAuth `CredentialsProvider` 하나뿐이며, DB 기반 사용자 계정이 없다. 기술 등록/수정/삭제 API(`/api/techniques`, `/api/techniques/[id]`)와 관리자 승인/거절 API(`/api/admin/approve`, `/api/admin/reject`)에는 실질적인 권한 검증이 없어(승인/거절 라우트는 세션 체크 코드가 통째로 주석 처리됨) 누구나 호출할 수 있는 상태다.

이번 작업의 목표는 실제 회원(User) 계정 체계를 도입하고, 기술 등록·수정·삭제를 관리자(admin) 권한을 가진 사용자만 할 수 있도록 제한하는 것이다.

## 1. User 데이터 모델 (`src/models/User.ts`)

| 필드 | 타입 | 설명 |
|---|---|---|
| `email` | `string`, required, unique, lowercase, index | 로그인 ID |
| `password` | `string`, required, `select: false` | bcrypt 해시. 기본 조회 시 제외되고 인증 시에만 명시적으로 select |
| `nickname` | `string`, required, unique | 표시 이름 |
| `role` | `'user' \| 'admin'`, default `'user'` | 권한 구분. 관리자만 기술 등록/수정/삭제 가능 |
| `level` | `'white' \| 'blue' \| 'purple' \| 'brown' \| 'black'`, default `'white'` | 주짓수 벨트 등급 |
| `stripe` | `number`, min 0, max 4, default 0 | 벨트 그랄(스트라이프) 수 |
| `period` | `Date`, optional | 주짓수 수련 시작일 |
| `mySkills` | `ObjectId[]` (ref: `Technique`), default `[]` | 사용자가 등록(관심 표시)한 기술 목록 |
| `myCombo` | `[{ name: string, techniques: ObjectId[] (ref: Technique) }]`, default `[]` | 사용자가 등록한 콤보 배열 |

+ `timestamps: true` (createdAt/updatedAt)

비고:
- `myCombo`의 `name`은 스키마 default로 자동 채번할 수 없다(몇 번째 콤보인지는 기존 개수를 세어봐야 안다). 이번 작업 범위에는 콤보 생성 API가 포함되지 않으므로, 스키마에는 `name: { type: String, required: true }`로만 정의하고 채번 로직은 향후 콤보 관리 기능 구현 시 API 레벨에서 처리한다.
- 기존 `Technique` 모델의 `createdBy`/`lastEditedBy` 필드가 이미 `ref: 'User'`로 되어 있어 그대로 연결된다.

## 2. 인증 흐름 변경

- **비밀번호 해싱**: `bcryptjs` 패키지를 신규 의존성으로 추가한다(서버리스 배포 환경 호환성을 위해 네이티브 `bcrypt` 대신 순수 JS 구현 사용).
- **회원가입**:
  - `POST /api/auth/signup` 신규 라우트 추가. `email`, `password`, `nickname`을 받아 검증(이메일/닉네임 중복 체크, 비밀번호 최소 길이) 후 `bcrypt.hash`로 해싱하여 `role: 'user'`로 고정 생성.
  - `/app/auth/signup/page.tsx` 신규 페이지 추가(기존 `/app/auth/signin/page.tsx`와 유사한 스타일의 폼: email, password, nickname).
  - 로그인 페이지에 회원가입 페이지로 가는 링크 추가.
- **로그인**:
  - `CredentialsProvider.authorize()`를 `.env` 비교 방식에서 `User.findOne({ email }).select('+password')` 후 `bcrypt.compare()`로 검증하는 방식으로 교체.
  - 인증 성공 시 반환 객체에 `id`, `email`, `nickname`, `role` 포함.
- **세션/JWT 확장**:
  - `jwt` 콜백에서 `token.role`, `token.id` 저장.
  - `session` 콜백에서 `session.user.role`, `session.user.id`로 노출.
  - `next-auth.d.ts` 타입 선언 파일을 추가해 `Session.user`, `User`, `JWT`에 `role`/`id` 필드를 타입으로 확장(현재 코드 곳곳의 `as { role?: string }` 캐스팅 제거).
- **`authOptions` 분리**:
  - 현재 `[...nextauth]/route.ts` 내부에 정의된 `NextAuth(...)` 설정 객체를 `src/lib/auth.ts`의 `authOptions`로 분리하고, route.ts는 이를 import해서 핸들러만 생성하도록 변경.
  - 이렇게 해야 다른 API 라우트에서 `getServerSession(authOptions)`를 올바르게 호출할 수 있다(현재 admin approve 라우트가 이 문제로 인증 체크를 통째로 주석 처리해둔 상태였음).

## 3. 권한 검증 (관리자 전용 가드)

- `src/lib/auth.ts`에 `requireAdmin()` 헬퍼 함수를 추가한다. 세션이 없으면 401, 세션은 있지만 `role !== 'admin'`이면 403을 반환하는 `NextResponse`를 만들어 반환하고(또는 인증 통과 시 세션 객체 반환), 각 API 라우트에서 이 헬퍼를 호출해 결과를 바로 리턴할 수 있게 한다.
- 적용 대상 라우트:
  - `POST /api/techniques` (등록)
  - `PUT /api/techniques/[id]` (수정)
  - `DELETE /api/techniques/[id]` (삭제)
  - `POST /api/admin/approve`
  - `POST /api/admin/reject`
- `GET` 계열 라우트(`/api/techniques`, `/api/techniques/[id]`)는 그대로 공개 유지 — 위키 열람은 비로그인 사용자도 가능해야 하므로 이번 작업에서 건드리지 않는다.

## 4. 작업 범위(Scope)

**포함**:
- User 모델 전체 필드 정의 (위 8개 필드 + role)
- 회원가입 API + 페이지
- 로그인을 DB 기반으로 전환
- 기술 등록/수정/삭제 및 관리자 승인/거절에 대한 관리자 권한 가드

**미포함** (스키마 필드는 정의하지만, 아래 기능은 이번 작업에 포함하지 않고 별도 작업으로 분리):
- `mySkills`에 기술을 추가/제거하는 API 및 UI
- `myCombo` 생성/수정/삭제 API 및 화면
- 마이페이지(프로필 조회/수정) 화면

이유: 이번 요청의 핵심은 "권한 관리"이며, 스킬/콤보 관리 기능은 별도의 UI/UX 설계가 필요한 독립적인 기능이기 때문이다.

## 5. 예상 변경/신규 파일 목록

- 신규: `src/models/User.ts`
- 신규: `src/lib/auth.ts` (authOptions, requireAdmin 헬퍼)
- 신규: `src/types/next-auth.d.ts` (세션/JWT 타입 확장)
- 신규: `src/app/api/auth/signup/route.ts`
- 신규: `src/app/auth/signup/page.tsx`
- 수정: `src/app/api/auth/[...nextauth]/route.ts` (authOptions를 lib/auth.ts에서 import하도록 축소)
- 수정: `src/app/api/techniques/route.ts` (POST에 requireAdmin 적용)
- 수정: `src/app/api/techniques/[id]/route.ts` (PUT/DELETE에 requireAdmin 적용)
- 수정: `src/app/api/admin/approve/route.ts` (requireAdmin 적용, 주석 처리된 인증 체크 코드 정리), `src/app/api/admin/reject/route.ts` (requireAdmin 적용)
- 수정: `src/app/auth/signin/page.tsx` (회원가입 페이지 링크 추가)
- 수정: `package.json` (`bcryptjs`, `@types/bcryptjs` 의존성 추가)
