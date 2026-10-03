# 구글 로그인 및 비밀번호 재설정 설계

## 목표
- next-auth v4 기반 기존 이메일/비밀번호 로그인에 **구글 로그인**을 추가한다.
- 이메일로 가입한 사용자가 **비밀번호를 재설정**할 수 있게 한다. 메일 발송은 Resend를 사용한다.

## 확정된 결정
| 항목 | 결정 |
|------|------|
| 메일 발송 | Resend |
| 계정 연결 | 같은 이메일 계정이 있고 구글 `email_verified`가 true이면 자동 연결 |
| 신규 구글 가입 닉네임 | 구글 이름 기반 자동 생성, 중복 시 숫자 접미사 |
| 재설정 토큰 저장 | 별도 `PasswordResetToken` 컬렉션 (해시 저장, TTL 인덱스) |

## 1. 구글 로그인

### 모델 (`src/models/User.ts`)
- `password`: `required` 제거, 선택값으로 변경 (`select: false` 유지).
- `googleId`: `String`, `unique` + `sparse` 인덱스 추가.
- `IUser` 인터페이스에 `password?: string`, `googleId?: string` 반영.

### 인증 (`src/lib/auth.ts`)
- `GoogleProvider` 추가 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- `signIn` 콜백 (provider가 google일 때):
  1. `profile.email_verified`가 true가 아니면 로그인 거부.
  2. 이메일(소문자·trim)로 사용자를 조회한다.
     - 있으면 `googleId`가 없을 때 연결한다. 비밀번호는 건드리지 않는다.
     - 없으면 새로 생성한다. 닉네임은 구글 이름에서 만들고, 중복되면 숫자를 붙인다. 이메일이 `ADMIN_EMAIL`과 같으면 `role`을 `admin`으로 한다 (가입 라우트와 동일 규칙).
  3. DB 사용자의 `id`, `role`, `nickname`을 `user` 객체에 덮어쓴다.
- `jwt` 콜백은 기존 구조를 유지한다. `signIn`에서 덮어쓴 `user.id`, `user.role`이 토큰에 들어간다.
- `authorize` (Credentials): `user.password`가 없으면 null을 반환한다. 구글 전용 계정은 비밀번호로 로그인할 수 없다.

### UI
- `/auth/signin`, `/auth/signup`에 "Google로 계속하기" 버튼을 추가한다 (`signIn('google', { callbackUrl })`).
- 로그인 후 이동은 기존 규칙과 같다. 관리자는 `/admin`, 그 외는 `/`.

## 2. 비밀번호 재설정

### 모델 (`src/models/PasswordResetToken.ts`)
- 필드: `user`(ObjectId), `tokenHash`(SHA-256, unique), `expiresAt`(Date), `createdAt`(`timestamps` 옵션으로 자동 기록).
- `expiresAt`에 TTL 인덱스 (`expireAfterSeconds: 0`). 유효 시간은 1시간.
- 원본 토큰(32바이트 랜덤, hex)은 메일 링크에만 담고 DB에는 해시만 저장한다.

### API
- `POST /api/auth/forgot-password` — `{ email }`
  - 사용자 존재 여부와 관계없이 항상 같은 성공 응답을 준다 (계정 열거 방지).
  - 사용자가 있으면 해당 사용자의 기존 토큰을 삭제하고 새 토큰을 만들어 Resend로 링크(`NEXTAUTH_URL/auth/reset-password?token=...`)를 발송한다.
  - 같은 사용자에 대해 직전 요청 후 60초 이내의 재요청은 메일을 보내지 않고 같은 응답만 준다 (토큰의 `createdAt` 기준).
- `POST /api/auth/reset-password` — `{ token, password }`
  - 비밀번호는 8자 이상 (가입 라우트와 동일).
  - `tokenHash`로 조회하고 만료 여부를 확인한다. 유효하면 bcrypt(10)로 해시해 저장하고, 해당 사용자의 토큰을 모두 삭제한다 (1회용).
  - 토큰이 없거나 만료되었으면 400과 일반 오류 메시지를 준다.
- 구글 전용 계정도 재설정할 수 있다. 재설정 후에는 비밀번호 로그인도 가능해진다.

### 메일 (`src/lib/mail.ts`)
- `resend` 패키지 사용. `RESEND_API_KEY`, `MAIL_FROM`을 읽는다.
- 한국어 제목과 본문, 재설정 링크 버튼, 1시간 유효 안내를 담는다.
- 발송 실패는 서버에서 로그만 남기고 사용자에게는 같은 성공 응답을 준다.

### UI
- `/auth/forgot-password`: 이메일 입력 폼. 제출 후 "메일을 보냈습니다" 안내를 보여준다.
- `/auth/reset-password`: 쿼리의 `token`과 새 비밀번호(확인 입력 포함)를 받는다. 성공하면 `/auth/signin`으로 이동한다.
- `/auth/signin`에 "비밀번호를 잊으셨나요?" 링크를 추가한다.
- 기존 화면 스타일(Tailwind 클래스, 한국어 문구)을 그대로 따른다.

## 3. 환경변수
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`을 `.env.local`에 추가한다. 값은 Google Cloud Console(승인된 리디렉션 URI: `{NEXTAUTH_URL}/api/auth/callback/google`)과 Resend 대시보드에서 직접 발급해야 하며 구현 과정에서 임의로 만들거나 입력하지 않는다.

## 4. 검증
- 저장소에 테스트 러너가 없어 도입하지 않는다.
- 로컬 서버에서 확인한다: 토큰 발급, 만료, 재사용 거부, 비존재 이메일 응답 동일성, 재요청 제한.
- 구글 신규 가입과 기존 계정 연결은 OAuth 키가 있어야 확인할 수 있다.
- `npm run lint`, `npm run build`를 통과시킨다.

## 범위 밖
- 이메일 인증(가입 시), 구글 연결 해제, 다른 소셜 로그인, 닉네임 입력 온보딩 화면.
