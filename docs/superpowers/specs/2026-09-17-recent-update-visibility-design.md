# 최근 업데이트 노출 기능 설계

- 작성일: 2026-09-17
- 대상 프로젝트: `02_bjjwiki`
- 관련 요청: 메인 페이지 공지 섹션, 사이드바 배지/정렬, 게시자·수정자 닉네임 노출

## 배경

세 요청 모두 "이 기술이 언제, 누구에 의해 바뀌었는가"를 사용자에게 보여주는 기능이다.
`Technique` 스키마에는 이미 `createdBy`, `lastEditedBy` 필드가 정의되어 있지만
(`src/models/Technique.ts:72-73`), 기술 생성/수정 흐름(`createTechniqueFromPayload`,
`applyTechniqueEdit`, 두 API 라우트, 요청 승인 라우트) 어디에서도 실제 값을 채운 적이
없다. 이번 작업의 선행 조건은 이 필드를 실제로 채우는 배선(wiring)이며, 세 기능은
공통으로 "최근 3일" 기준(`RECENT_UPDATE_WINDOW_DAYS`)을 공유한다.

## 범위

1. 메인 페이지(`src/app/page.tsx`)에 최근 3일 이내 수정된 기술을 한 줄로 보여주는
   자동 스크롤 공지 섹션 추가.
2. 사이드바(`src/components/layout/Sidebar.tsx`)에서 최근 3일 이내 수정된 기술에
   노란 원형 배지를 텍스트 왼쪽에 표시하고, 각 형제 그룹 내에서 목록 맨 위로 이동.
   3일이 지나면 원래 순서(관리자 커스텀 순서)로 복귀.
3. 기술 상세 페이지(`src/app/technique/[...slug]/page.tsx`)의 "최종 수정" 문구
   뒤에 게시자/수정자 닉네임을 이어서 노출.

범위 밖: 알림(Notification) 시스템 변경, TechniqueRequest 승인 UI 변경, 사이드바
"순서 편집" 기능 자체의 변경.

## 설계 변경: mongoose `updatedAt`을 "최근 수정" 기준으로 쓰지 않는다

최초 설계는 mongoose가 자동 관리하는 `updatedAt`(`{ timestamps: true }`)을 배지·
공지 기준으로 쓰려 했으나, 다음 기존 코드 경로들이 콘텐츠와 무관하게 `updatedAt`을
갱신시킨다는 문제가 있다:

- `PUT /api/techniques/reorder` — "순서 편집"에서 형제 그룹 전체의 `order`를
  갱신한다 (`Sidebar.tsx:141-155`). 한 번의 순서 변경 클릭으로 형제 기술 N개가
  전부 "방금 수정됨"으로 오인되어 배지가 무더기로 뜬다.
- `applyTechniqueEdit`의 부모 변경 처리 — 부모 기술에 `$push`/`$pull`로
  `childrenIds`만 갱신해도 그 부모의 `updatedAt`이 갱신된다.
- `DELETE /api/techniques/[id]` — 삭제 시 형제/부모의 `childrenIds`를 갱신하며
  마찬가지로 관련 없는 기술들의 `updatedAt`을 건드린다.
- (`viewCount`는 스키마에는 있으나 실제로 증가시키는 코드가 없음을 확인함 —
  조회수로 인한 오탐 위험은 없다.)

**해결:** "콘텐츠가 실제로 편집된 시각"만 담는 별도 필드 `contentUpdatedAt`을
`Technique` 스키마에 추가한다. 생성 시/실제 편집(`applyTechniqueEdit`에 실제
필드 변경이 있을 때)에만 `new Date()`로 채우고, reorder·부모-자식 정리·삭제
경로는 이 필드를 절대 건드리지 않는다. 배지·공지·정렬 판정은 전부
`contentUpdatedAt` 기준으로 하고, mongoose `updatedAt`은 지금처럼 그대로 둔다
(다른 기능이 이미 의존하고 있을 수 있으므로 손대지 않음).

레거시 기술(이 기능 배포 이전에 만들어진 기술)은 `contentUpdatedAt`이 없다 →
"최근 수정 아님"으로 취급 → 배지도 안 뜨고 공지에도 안 뜬다. 이 데이터를
채우는 백필(backfill)은 하지 않는다 — 실제로 다시 수정되기 전까지는 "최근
수정된 적 없음"이 맞는 상태다.

## 공통 상수

`src/lib/technique-service.ts`는 `mongoose`/`dbConnect`를 import하는 서버 전용
모듈이라 `'use client'`인 `Sidebar.tsx`에서 그대로 가져올 수 없다. 대신 별도의
순수 상수 파일 `src/lib/recent-update.ts`(서버/클라이언트 어디서든 안전)를 만든다:

```ts
export const RECENT_UPDATE_WINDOW_DAYS = 3;

export function isWithinRecentWindow(contentUpdatedAt: string | Date | undefined | null): boolean {
  if (!contentUpdatedAt) return false; // 레거시 기술: 편집 이력 없음 -> 최근 아님
  const ms = RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(contentUpdatedAt).getTime() < ms;
}
```

`technique-service.ts`(서버, 쿼리 조건에 사용)와 `Sidebar.tsx`(클라이언트, 배지
판정에 사용) 양쪽에서 이 파일을 import한다.

## 1. 메인 페이지 공지 섹션

- `technique-service.ts`에 `getRecentlyUpdatedTechniques()` 추가.
  - 조건: `status: 'published'`, `contentUpdatedAt: { $gte: now - 3일 }`
  - 정렬: `contentUpdatedAt desc`
  - select: `_id name slug pathSlugs contentUpdatedAt`
  - 캐싱 없이(또는 짧은 revalidate) 매 요청 시 최신 상태 반영. 메인 페이지는 이미
    서버 컴포넌트이므로 별도 캐시 태그 없이 직접 조회.
- `src/components/home/AnnouncementTicker.tsx` (신규, client component)
  - props: `items: { _id: string; name: string; href: string }[]`
  - 항목이 0개면 부모(`page.tsx`)에서 아예 렌더링하지 않음.
  - 항목이 1개면 정적 표시(스크롤 없음).
  - 항목이 2개 이상이면 CSS keyframe `translateX`로 한 줄 자동 스크롤. 콘텐츠를
    2벌 복제해 이어붙여 seamless loop 구현 (`display:flex; animation: marquee Ns linear infinite`).
    복제된 두 번째 트랙에는 `aria-hidden="true"`를 붙여 스크린 리더가 항목을
    두 번 읽지 않게 한다.
  - 각 항목은 `Link`로 감싸 해당 기술 상세 페이지로 이동.
- `src/app/page.tsx`에서 Hero 섹션 위(또는 바로 아래)에 배치.

## 2. 사이드바 배지 + 정렬

- `getTechniqueTree()` (`technique-service.ts`) select에 `contentUpdatedAt` 추가하고
  트리 노드 매핑 시 `contentUpdatedAt: tech.contentUpdatedAt ? tech.contentUpdatedAt.toISOString() : null`로
  함께 내려줌 (레거시 기술은 필드 자체가 없을 수 있으므로 optional 처리).
- `Sidebar.tsx`:
  - `src/lib/recent-update.ts`의 `isWithinRecentWindow(node.contentUpdatedAt)`로
    배지 여부 판정.
  - 렌더링 직전에 형제 배열을 안정 정렬: `[...nodes.filter(recent), ...nodes.filter(!recent)]`.
    각 partition 내부의 상대 순서는 서버가 이미 정렬한 순서(`order asc, name.ko asc`)를
    그대로 보존 — 관리자 커스텀 순서를 해치지 않는다.
  - 트리의 모든 depth(루트 포함)에서 동일하게 적용 (재귀 렌더링 `renderNode`에서
    `children`을 그릴 때도 동일 partition 적용).
  - 배지: `<span className="h-2 w-2 rounded-full bg-yellow-400 mr-1.5 shrink-0" />`를
    `Link` 텍스트 바로 앞에 삽입.

## 3. 게시자 / 수정자 닉네임 노출

### 데이터 배선

- `createTechniqueFromPayload(payload, actorId?)` — 시그니처에 `actorId` 파라미터
  추가. `Technique.create({...body, contentUpdatedAt: new Date(), ...(actorId
  && { createdBy: actorId })})`로 저장 — 생성은 항상 `contentUpdatedAt`을 채운다.
  - 호출부 `src/app/api/techniques/route.ts` POST: `session.user.id` 전달
    (이미 `requireAdmin()`에서 `session`을 받아옴).
  - 호출부 `src/app/api/technique-requests/[id]/approve/route.ts` (`type === 'create'`):
    `techniqueRequest.submittedBy` 전달 (요청을 실제로 작성한 사람).
- `applyTechniqueEdit(id, payload, actorId?)` — 실제로 갱신할 필드가 있을 때만
  `lastEditedBy`/`contentUpdatedAt`을 추가한다. 순서가 중요하므로 그대로 반영:
  ```ts
  const update = buildTechniqueUpdateSet(body);
  if (Object.keys(update).length === 0) {
    return currentTechnique; // 실질 변경 없음 -> 편집자/시각 갱신 안 함
  }
  if (actorId) {
    update.lastEditedBy = actorId;
  }
  update.contentUpdatedAt = new Date();
  ```
  (기존의 "빈 업데이트면 조기 리턴" 체크 **다음에** 주입 — 그래야 아무 필드도
  안 바뀐 저장 요청이 "방금 수정됨"으로 오인되지 않는다.)
  - 호출부 `src/app/api/techniques/[id]/route.ts` PUT: `requireAdmin()`에서
    `session`을 받아 `session.user.id` 전달 (현재는 `error`만 구조분해하고 있어
    `session`도 받도록 수정 필요).
  - 호출부 approve 라우트 (`else` 분기, 수정 승인): `techniqueRequest.submittedBy` 전달.
- `Technique` 스키마(`src/models/Technique.ts`)에 `contentUpdatedAt?: Date` 필드
  추가 (인덱스: `{ status: 1, contentUpdatedAt: -1 }` — 공지 섹션 쿼리에 사용).

### 조회/표시

- `src/app/api/techniques/[id]/route.ts` GET: `.populate('createdBy', 'nickname')`,
  `.populate('lastEditedBy', 'nickname')` 추가.
- `src/app/technique/[...slug]/page.tsx`의 `Technique` 인터페이스에
  `createdBy?: { nickname: string }`, `lastEditedBy?: { nickname: string }` 추가.
- "최종 수정" 날짜 자체는 지금처럼 mongoose `updatedAt`을 그대로 쓴다 (reorder 등
  사소한 변경에도 갱신되는 성질이 여기서는 오히려 자연스럽다 — 배지/공지 판정만
  콘텐츠 편집 여부를 엄격히 구분하면 된다). footer 렌더링 변경:
  ```
  최종 수정: {날짜}{createdBy && ` · 게시자: ${createdBy.nickname}`}{lastEditedBy && ` · 수정자: ${lastEditedBy.nickname}`}
  ```
  - `lastEditedBy`는 존재할 때만 표시 (생성 후 한 번도 수정 안 된 기술은 게시자만
    노출 — 같은 사람을 두 번 보여주지 않기 위함).
  - 레거시 데이터(값이 없는 기존 기술)는 해당 문구 자체를 생략한다 ("알 수 없음"
    같은 placeholder 없이).

## 영향받는 파일 (요약)

- `src/models/Technique.ts` — `contentUpdatedAt?: Date` 필드 + 인덱스 추가
- `src/lib/recent-update.ts` — 신규, `RECENT_UPDATE_WINDOW_DAYS` / `isWithinRecentWindow`
- `src/lib/technique-service.ts` — `getRecentlyUpdatedTechniques`, 트리
  select에 `contentUpdatedAt`, `createTechniqueFromPayload`/`applyTechniqueEdit` 시그니처
- `src/app/page.tsx` — 공지 섹션 데이터 fetch 및 배치
- `src/components/home/AnnouncementTicker.tsx` — 신규
- `src/components/layout/Sidebar.tsx` — 배지 + partition 정렬
- `src/app/api/techniques/route.ts` — POST에 `session.user.id` 전달
- `src/app/api/techniques/[id]/route.ts` — GET populate, PUT에 `session.user.id` 전달
- `src/app/api/technique-requests/[id]/approve/route.ts` — `submittedBy` 전달
- `src/app/technique/[...slug]/page.tsx` — 인터페이스 + footer 렌더링

## 테스트 인프라에 대한 참고

이 프로젝트에는 현재 테스트 러너가 없다 (`package.json`의 스크립트는
`dev`/`build`/`start`/`lint`뿐이고 `*.test.ts` 파일도 없음). 이 기능을 위해
jest/vitest 등을 새로 도입하지 않는다 (범위를 벗어난 인프라 추가). 대신 각
작업 단위마다 `npm run lint` + `npm run build`(타입체크 겸함)를 게이트로 쓰고,
시각적/동작 검증은 `preview_start`로 띄운 브라우저에서 직접 확인한다.

## 테스트 계획

- 신규 기술 생성(직접/요청승인) 후 `createdBy`와 `contentUpdatedAt`이 채워지는지
  API 응답으로 확인.
- 기존 기술 수정(직접/요청승인) 후 `lastEditedBy`와 `contentUpdatedAt`이 채워지는지 확인.
- **회귀 확인**: 사이드바 "순서 편집"으로 형제 순서만 바꾼 뒤, 그 형제들에
  배지가 새로 뜨지 않는지 확인 (`contentUpdatedAt`이 갱신되지 않았어야 함).
- 사이드바에서 방금 수정한 기술이 배지와 함께 형제 그룹 최상단에 오는지, 3일 이전
  타임스탬프로 설정 시 원래 순서로 돌아오는지 브라우저에서 확인.
- 메인 페이지에서 항목 0개/1개/2개 이상 케이스의 렌더링(섹션 숨김/정적/스크롤)을
  브라우저에서 확인.
- 레거시 기술(값 없음) 상세 페이지에서 게시자/수정자 문구가 깨지지 않고 생략되는지 확인.
