# 콤보(Combo) 등록/저장 기능 설계

## 배경

기술들을 순서대로 이어붙인 "콤보"를 유저가 등록하고, 다른 유저는 그 콤보를 목록에서 보고 저장할 수 있게 한다. `User` 모델에는 `myCombo`라는 필드가 이미 있지만 `{name, techniques}[]` 형태의 개인 전용 구조이고 실제로 어디서도 읽거나 쓰지 않는 미사용 필드다(코드 전체 검색 결과 정의 외에 참조가 없음). 이번 기능은 "여러 유저가 같은 콤보를 보고 저장"하는 전역 목록이 필요하므로, `myCombo`는 제거하고 별도의 전역 `Combo` 컬렉션을 새로 만든다.

## 1. 데이터 모델

### 1.1 `Combo` (신규, `src/models/Combo.ts`)

```ts
export interface ICombo extends Document {
  name: string;
  techniques: mongoose.Types.ObjectId[]; // 순서 있는 기술 체인, 2개 이상
  videoUrl?: string;
  photoUrl?: string;
  createdBy: mongoose.Types.ObjectId; // User
  saveCount: number; // 비정규화된 저장 수 (정렬용)
  createdAt: Date;
  updatedAt: Date;
}
```

- `techniques`는 최소 2개 이상이어야 한다(스키마 레벨 `validate`로 강제). 하나의 기술만 있는 건 "콤보"가 아니므로.
- `videoUrl`/`photoUrl`은 둘 다 선택(둘 중 하나만 있어도, 둘 다 없어도 됨).
- `saveCount`는 `POST /api/combos/[id]/save`에서 갱신한다. 실시간으로 `User.savedCombos`를 세는 대신 비정규화해서 목록 정렬 시 매번 집계하지 않도록 한다.
- 인덱스: `saveCount` 내림차순 정렬용 인덱스, `createdBy` 인덱스.

### 1.2 `User` 모델 변경 (`src/models/User.ts`)

- `myCombo: IUserCombo[]` 필드와 `IUserCombo` 인터페이스, `ComboSchema`를 제거한다(미사용 확인됨).
- `savedCombos: mongoose.Types.ObjectId[]` (ref: `Combo`, default `[]`)를 추가한다.

### 1.3 `Image` 모델 변경 (`src/models/Image.ts`)

- `usage` enum에 `'combo_photo'`를 추가한다: `['technique_thumbnail', 'technique_photo', 'user_thumbnail', 'combo_photo']`.

## 2. API

### 2.1 `POST /api/upload` 권한 완화 (`src/app/api/upload/route.ts`)

현재는 `requireAdmin()`으로 전체가 막혀 있다. `usage === 'combo_photo'`일 때만 로그인 여부만 확인(관리자 불필요)하도록 분기하고, 그 외 기존 `usage` 값들은 계속 `requireAdmin()`을 유지한다.

```ts
const usage = formData.get('usage') as string;

if (usage === 'combo_photo') {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  uploaderType = session.user.role === 'admin' ? 'admin' : 'user';
} else {
  const { session, error: authError } = await requireAdmin();
  if (authError) return authError;
  uploaderType = session!.user.role;
}
```

### 2.2 `GET /api/combos` (신규, `src/app/api/combos/route.ts`)

- 인증 불필요(공개 목록).
- 정렬: 기본 `saveCount` 내림차순. `?sort=recent`이면 `createdAt` 내림차순.
- 각 기술 참조는 `name`, `slug`, `pathSlugs`만 populate(목록에서 체인 요약 문자열을 만드는 데 필요).
- 로그인 상태면 응답의 각 항목에 `savedByMe: boolean`을 함께 내려준다(현재 유저의 `savedCombos`에 포함되는지 확인).
- 응답 예: `{ success: true, data: [{ _id, name, techniques: [{_id,name,slug,pathSlugs}], videoUrl, photoUrl, createdBy: {_id,nickname}, saveCount, savedByMe }] }`

### 2.3 `GET /api/combos/[id]` (신규, `src/app/api/combos/[id]/route.ts`)

- 인증 불필요. `techniques`(name/slug/pathSlugs), `createdBy`(nickname) populate.
- 로그인 상태면 `savedByMe` 포함(목록과 동일한 방식).
- 존재하지 않으면 404.

### 2.4 `POST /api/combos` (같은 파일 `src/app/api/combos/route.ts`)

- 로그인 필요. 비로그인 401.
- Body: `{ techniques: string[], videoUrl?: string, photoUrl?: string }`.
- 검증:
  1. `techniques`가 배열이고 길이 2 이상, 각 원소가 유효한 ObjectId인지.
  2. 각 ID가 실제 존재하는 `Technique`인지(`Technique.countDocuments({_id: {$in: techniques}}) === techniques.length`로 확인).
  3. 동일한 순서의 `techniques` 배열을 가진 `Combo`가 이미 있으면 400 (`Combo.findOne({ techniques: techniqueObjectIds })` — Mongoose/MongoDB는 배열 필드에 배열 값을 그대로 질의하면 순서·길이까지 정확히 일치하는 문서만 매칭한다).
- 이름 생성: `현재 유저가 만든 콤보 수 + 1`을 `Combo.countDocuments({ createdBy: session.user.id })`로 구해서 `"{nickname} 콤보{n}"` 형태로 만든다.
- 생성 후 `saveCount: 0`으로 저장하고, 생성된 콤보를 응답으로 반환.

### 2.5 `PATCH /api/combos/[id]` (신규, `src/app/api/combos/[id]/route.ts`)

- 로그인 필요. 콤보의 `createdBy`가 본인이거나 `session.user.role === 'admin'`이어야 함(아니면 403).
- Body: `{ name?: string, videoUrl?: string, photoUrl?: string }` — 부분 업데이트. `techniques`는 이 엔드포인트에서 다루지 않는다(범위 밖 — 체인을 바꾸려면 삭제 후 재등록).
- `name`이 빈 문자열이면 400(빈 이름 금지).

### 2.6 `DELETE /api/combos/[id]` (같은 파일)

- 로그인 필요. `createdBy` 본인 또는 admin만. 아니면 403.
- 삭제 시 이 콤보를 저장해둔 모든 유저의 `savedCombos`에서도 제거한다(`User.updateMany({ savedCombos: id }, { $pull: { savedCombos: id } })`) — 안 그러면 고아 참조가 남는다.

### 2.7 `POST /api/combos/[id]/save` (신규, `src/app/api/combos/[id]/save/route.ts`)

- 로그인 필요. 비로그인 401.
- 토글 방식: 이미 저장했으면 저장 취소, 아니면 저장.
  - 저장: `User.savedCombos`에 추가(중복 방지), `Combo.saveCount += 1`.
  - 취소: `User.savedCombos`에서 제거, `Combo.saveCount -= 1`(0 이하로 내려가지 않게 `Math.max(0, ...)`).
- 응답: `{ success: true, data: { saved: boolean, saveCount: number } }`.

## 3. UI

### 3.1 `/combo` 목록 페이지 (신규, `src/app/combo/page.tsx`)

- 인기순(기본) 카드 그리드. 각 카드: 콤보 이름, 기술 체인 요약(`기술1.name.ko → 기술2.name.ko → ...`), 저장수, 저장 버튼(하트/북마크 아이콘 — 로그인 안 했으면 클릭 시 `/auth/signin`으로 이동), 카드 클릭 시 `/combo/[id]`로 이동.
- 상단에 "콤보 등록" 버튼 — 로그인 상태면 `/combo/new`로, 비로그인이면 `/auth/signin`으로 이동.

### 3.2 `/combo/new` 등록 페이지 (신규, `src/app/combo/new/page.tsx`)

- 비로그인이면 `/auth/signin`으로 리다이렉트(기존 `technique/new` 패턴에서 admin 체크 대신 로그인 체크만 사용).
- 기술 검색 입력창(`/api/techniques?search=...&fields=light` 재사용, `SearchModal`과 동일한 디바운스 검색) → 결과 클릭 시 체인 목록 맨 끝에 추가.
- 체인 목록: 선택된 순서대로 나열, 각 항목에 위/아래 이동 버튼과 삭제(X) 버튼. 최소 2개 미만이면 저장 버튼 비활성화 + 안내 문구.
- 영상 URL 입력(선택, 단순 text input).
- 사진 업로드(선택) — 기존 `technique/[...slug]/page.tsx`의 썸네일 업로드와 동일한 패턴(`browser-image-compression`으로 압축 후 `/api/upload`에 `usage=combo_photo`로 전송).
- 저장 버튼 클릭 → `POST /api/combos` → 성공 시 `/combo/[id]`로 이동. 서버가 중복(400)을 반환하면 "이미 등록된 콤보입니다" 에러 메시지를 표시.

### 3.3 `/combo/[id]` 상세 페이지 (신규, `src/app/combo/[id]/page.tsx`)

- 이름, 등록자 닉네임, 저장수 표시.
- 기술 체인을 순서대로 카드/화살표로 나열, 각 기술 클릭 시 해당 기술 상세 페이지(`/technique/[...slug]`)로 이동.
- 영상(있으면 iframe 임베드, 기술 상세 페이지의 유튜브 임베드 로직 재사용) / 사진(있으면 표시).
- 저장 버튼(토글, `POST /api/combos/[id]/save`).
- `createdBy === 본인` 또는 `role === 'admin'`이면 수정/삭제 버튼 노출:
  - 수정: 기술 상세 페이지와 같은 "수정 모드 토글" 패턴으로 이름/영상 URL/사진만 편집(기술 체인은 읽기 전용으로 그대로 보여줌).
  - 삭제: 확인 모달 후 `DELETE /api/combos/[id]` → 성공 시 `/combo` 목록으로 이동.

### 3.4 네비게이션

- `src/components/layout/Sidebar.tsx` 또는 `Navbar.tsx`에 "콤보" 링크(`/combo`)를 추가한다(정확한 위치는 구현 시 기존 네비게이션 구조를 보고 자연스러운 자리에 넣는다).

## 4. 범위 밖

- 기술로 콤보 목록 검색/필터 (나중에 추가 가능하도록 API 구조만 열어둠 — 지금은 만들지 않음).
- 영상 파일 직접 업로드 (URL 입력만 지원).
- 등록 후 기술 체인 자체 수정 (삭제 후 재등록으로 대체).
- 좋아요/댓글 등 추가 소셜 기능.
- 콤보 목록 페이지네이션 (기술 목록도 페이지네이션 없이 전체 반환하는 기존 패턴을 따름).

## 5. 예상 변경/신규 파일 목록

- 신규: `src/models/Combo.ts`
- 수정: `src/models/User.ts` (`myCombo` 제거, `savedCombos` 추가)
- 수정: `src/models/Image.ts` (`usage` enum에 `combo_photo` 추가)
- 수정: `src/app/api/upload/route.ts` (`combo_photo`일 때 로그인만 요구하도록 분기)
- 신규: `src/app/api/combos/route.ts` (`GET` 목록, `POST` 생성)
- 신규: `src/app/api/combos/[id]/route.ts` (`GET` 상세, `PATCH` 수정, `DELETE` 삭제)
- 신규: `src/app/api/combos/[id]/save/route.ts` (`POST` 저장 토글)
- 신규: `src/app/combo/page.tsx` (목록)
- 신규: `src/app/combo/new/page.tsx` (등록)
- 신규: `src/app/combo/[id]/page.tsx` (상세/수정/삭제)
- 수정: `src/components/layout/Sidebar.tsx` 또는 `Navbar.tsx` (콤보 링크 추가)
