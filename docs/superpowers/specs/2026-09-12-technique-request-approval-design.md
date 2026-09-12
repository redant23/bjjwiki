# 기술 등록/수정 요청 승인 워크플로우 설계

날짜: 2026-09-12

## 배경

현재 `POST/PUT /api/techniques*`는 `requireAdmin`으로 막혀 있어 일반 계정은 기술을 등록하거나
수정할 수 없다. 기술 상세 페이지의 `canEditTechnique()`는 "일단 누구나 편집 가능"으로
스텁되어 있어 UI상으로는 편집 버튼이 보이지만 저장 시 서버에서 403이 난다
(`src/app/technique/[...slug]/page.tsx:38`).

과거에 만들다 만 승인 워크플로우 잔재도 존재한다: `src/app/admin/page.tsx`는
`status=pending` 기술을 조회하고 `src/app/api/admin/approve/route.ts`는
`status: 'approved', is_current_version: true`로 갱신하지만, `Technique` 모델의
`status` enum은 `draft | published | archived`뿐이라 `pending`, `approved`,
`is_current_version` 모두 실제로는 존재하지 않는 값이다. 즉 이 코드는 죽어 있다.

이번 작업은 일반 계정이 기술을 등록/수정 **요청**할 수 있게 하고, 관리자가 요청 목록에서
검토 후 승인/반려할 수 있는 정식 워크플로우를 만들어 위 잔재를 대체한다. 승인/반려 결과는
사용자에게, 새 요청 도착은 관리자에게 인앱 알림으로 전달한다.

## 범위

- 신규 기술 등록 요청, 기존 published 기술 수정 요청 (둘 다 포함)
- 관리자는 기존처럼 즉시 반영(요청 큐를 거치지 않음). 일반 계정만 요청 큐를 거친다.
- 삭제는 이번 범위에 포함하지 않음 (계속 관리자 전용, 즉시 실행).
- 이메일 등 외부 알림은 포함하지 않음. 인앱 알림 센터만 구현.

## 데이터 모델

### `TechniqueRequest` (신규)

```ts
type: 'create' | 'edit'
targetTechniqueId?: ObjectId  // ref Technique, edit일 때만 존재
payload: {                    // 화이트리스트된 필드만, 폼에서 실제로 채운 키만 포함
  name?, aka?, description?, type?, primaryRole?, roleTags?,
  difficulty?, isCorePosition?, positionType?, parentId?,
  videos?, images?, thumbnailUrl?
}
status: 'pending' | 'approved' | 'rejected'
submittedBy: ObjectId          // ref User
reviewedBy?: ObjectId          // ref User
reviewNote?: string            // 반려 시 필수
createdAt, updatedAt
```

**중요 — payload 화이트리스트:** `POST /api/techniques`와 `PUT /api/techniques/[id]`는
현재 요청 body를 필터링 없이 그대로 `Technique.create`/`findByIdAndUpdate`에 넘긴다
(admin 전용이라 지금까지는 안전했음). 일반 사용자가 제출한 payload가 승인 시 그대로
적용되면 `status`, `order`, `viewCount`, `likeCount`, `createdBy`, `childrenIds`,
`level`, `pathSlugs`, `_id` 같은 필드를 임의로 주입하는 권한 상승이 가능해진다.
`POST /api/technique-requests`에서 body를 받을 때 위 편집 가능 필드 목록으로 명시적으로
pick하여 `payload`에 저장한다. 그 외 필드는 서버가 파생한다(슬러그, level, pathSlugs 등).

**diff는 저장하지 않는다.** 검토 화면에서 `targetTechniqueId`로 현재 라이브 `Technique`
문서를 조회해 `payload`와 그 자리에서 비교한다 (스냅샷을 따로 저장하면 관리자가 그 사이
직접 수정했을 때 오히려 오래된 값을 기준으로 diff를 보여주게 됨).

**슬러그는 제출 시점이 아니라 승인 시점에 생성한다.** 이름이 같은 두 개의 pending 요청이
있을 수 있으므로, 승인 시점에 라이브 컬렉션 기준으로 유일성을 확인해야 한다.

### `Notification` (신규)

```ts
user: ObjectId        // 수신자
type: 'request_approved' | 'request_rejected' | 'new_request'
message: string
relatedRequestId: ObjectId   // ref TechniqueRequest
isRead: boolean
createdAt
```

## API

### 공통 준비

- `src/lib/auth.ts`에 `requireAuth()` 추가 — role 무관하게 로그인 여부만 확인 (기존
  `requireAdmin()`과 나란히 둔다).
- `src/app/api/upload/route.ts`가 현재 `requireAdmin`이라 일반 계정은 썸네일 업로드조차
  안 된다. `requireAuth`로 완화한다 (이 변경이 없으면 일반 사용자의 등록 요청 폼이 이미지
  업로드 단계에서 막힌다).
- `src/lib/technique-service.ts`에 다음 로직을 함수로 추출해서 관리자 직접 라우트와 승인
  라우트가 공유하게 한다 (지금은 `POST /api/techniques`와 `PUT /api/techniques/[id]`에만
  각각 들어있음):
  - `createTechniqueFromPayload(payload)` — slugify + 유일성 루프, 부모 있으면
    level/pathSlugs 계산 + 부모의 `childrenIds`에 push (route.ts:120-161 로직 이전)
  - `applyTechniqueEdit(id, payload)` — 부모 변경 시 기존 부모에서 제거/새 부모에 추가,
    level/pathSlugs 갱신 (route.ts:58-88 로직 이전), 그 외 필드는 `payload`에 있는 키만
    `$set`

### 신규 라우트

- `POST /api/technique-requests` — 로그인 사용자(`requireAuth`). 기존
  `src/lib/rate-limit.ts`의 `rateLimit`을 적용 (admin 전용이던 라우트를 대체하며 스팸
  표면이 넓어지므로). body: `{ type, targetTechniqueId?, payload }`. payload를
  화이트리스트로 pick 후 저장. 저장 후 모든 `role: 'admin'` 사용자에게 `new_request`
  알림 생성.
- `GET /api/technique-requests` — `?mine=1`이면 `submittedBy`가 본인인 것만 (일반 계정
  기본값이자 유일한 옵션). 관리자는 `?status=pending` 등으로 전체 조회 가능. 일반 계정이
  `mine` 없이 호출해도 서버에서 강제로 본인 것만 필터링한다.
- `GET /api/technique-requests/[id]` — 관리자이거나 본인이 제출한 요청만 조회 가능.
- `POST /api/technique-requests/[id]/approve` — 관리자 전용. `type === 'create'`면
  `createTechniqueFromPayload`, `'edit'`이면 `applyTechniqueEdit(targetTechniqueId, payload)`
  호출. 처리 후: 요청 status를 `approved`로, `reviewedBy` 기록. 제출자에게
  `request_approved` 알림 생성. 같은 `relatedRequestId`를 가진 다른 관리자들의
  `new_request` 알림도 함께 읽음 처리(안 그러면 다른 관리자 벨이 계속 켜져 있음).
- `POST /api/technique-requests/[id]/reject` — 관리자 전용. body에 `reviewNote` 필수
  (없으면 400). status를 `rejected`로, `reviewNote`/`reviewedBy` 기록. 제출자에게 사유를
  포함한 `request_rejected` 알림 생성. 이 요청에 대한 다른 관리자들의 `new_request`
  알림도 읽음 처리.
- `GET /api/notifications` — 본인의 최근 알림 + 안읽음 개수.
- `POST /api/notifications/[id]/read` — 단건 읽음 처리.
- `POST /api/notifications/read-all` — 전체 읽음 처리.

### 기존 라우트

- `src/app/api/admin/approve/route.ts`, `src/app/api/admin/reject/route.ts` 삭제 (죽은
  코드, 위 신규 라우트로 대체).
- `POST /api/techniques`, `PUT /api/techniques/[id]`는 그대로 관리자 전용 유지, 단
  공통 로직은 위에서 추출한 서비스 함수를 호출하도록 리팩터링.

## UI

- **`/technique/new`**: 접근 가드를 "admin"에서 "로그인 사용자"로 완화. 제출 시 role
  분기 — admin은 기존과 동일하게 `POST /api/techniques`로 즉시 게시. 일반 계정은
  `POST /api/technique-requests` (`type: 'create'`)로 제출 후 "관리자 확인 후
  게시됩니다" 안내 메시지와 함께 프로필 페이지로 이동 (아직 라이브 페이지가 없으므로
  기술 상세로 리다이렉트할 수 없음).
- **기술 상세 페이지 (`src/app/technique/[...slug]/page.tsx`)**: `canEditTechnique()`를
  "로그인 사용자면 true"로 변경. 삭제 버튼은 계속 admin에게만 노출(별도 조건 추가,
  서버의 `requireAdmin`은 그대로 백스톱). 저장 시 role 분기 — admin은 기존과 동일하게
  `PUT`으로 즉시 반영. 일반 계정은 `POST /api/technique-requests` (`type: 'edit'`,
  `targetTechniqueId`)로 제출, 화면의 라이브 데이터는 그대로 두고(원본 미변경) "수정
  요청이 접수되었습니다. 관리자 확인 후 반영됩니다" 토스트만 표시 후 편집 모드 종료.
- **관리자 대시보드 (`/admin`)**: 죽은 `status=pending` 조회를 걷어내고
  `GET /api/technique-requests?status=pending`로 교체. 목록에 유형(신규/수정), 대상
  기술명(또는 제안된 이름), 제출자 닉네임, 제출일 표시. 행 클릭 시
  `/admin/requests/[id]`로 이동.
- **`/admin/requests/[id]` (신규)**: `edit` 요청은 필드별 변경 전(현재 라이브 값)/후
  (payload) 비교를 보여준다. `create` 요청은 전체 내용 미리보기. 조회 시점에
  `targetTechniqueId`가 있으면 해당 기술의 `updatedAt`을 함께 가져와
  `updatedAt > request.createdAt`이면 "관리자가 이 요청 제출 이후 기술을 직접
  수정했습니다"라는 경고를 표시한다. 승인/반려 버튼. 반려는 사유 입력 모달을 거쳐야
  제출 가능.
- **프로필 페이지**: 기존 `MySkillsSection` 아래에 `MyRequestsSection` 컴포넌트 추가 —
  `GET /api/technique-requests?mine=1`로 본인 요청 목록과 상태(대기중/승인됨/반려됨+사유)
  표시.
- **알림 벨 (`NavbarClient`)**: `NotificationBell` 컴포넌트 신규 추가. 안읽음 개수 뱃지 +
  드롭다운 목록(메시지, 상대 시간, 안읽음 표시). 클릭 시 해당 알림 읽음 처리 후 관련
  페이지로 이동 (`request_approved`/`request_rejected` → 프로필의 내 요청 섹션,
  `new_request` → `/admin/requests/[id]`). 60초 간격 폴링으로 뱃지 갱신.
- Navbar의 "기술 등록" 버튼 노출 조건을 "미로그인 또는 admin"에서 "미로그인(→가입) 또는
  로그인 사용자(→ `/technique/new`)"로 확장.

## 엣지 케이스

- 승인 시점에 대상 기술이 이미 삭제된 경우 → 승인 실패 처리, 요청은 `rejected`로 자동
  전환하고 제출자에게 사유("대상 기술이 삭제됨")를 포함한 알림 발송.
- 같은 사용자가 같은 기술에 대해 이미 `pending` 수정 요청을 가지고 있는 경우 → 새 요청
  제출을 막고 기존 요청 화면으로 안내 (중복 대기열 방지).
- 반려된 요청은 재제출 가능해야 하므로 재제출 시 새 `TechniqueRequest` 문서를 만든다
  (기존 문서를 수정하지 않음 — 이력 보존).

## 제외 사항 (이번 범위 아님)

- 기술 삭제 요청 워크플로우
- 이메일/푸시 알림
- 실시간(WebSocket) 알림 갱신 — 폴링으로 충분
- 요청 일부 필드만 승인하는 부분 승인 기능
