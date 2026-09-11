# 상위 기술 선택 UI 개선 설계

## 배경

기술 등록(`technique/new/page.tsx`)과 기술 수정(`technique/[...slug]/page.tsx`의 수정 모드) 양쪽 모두 "상위 기술" 필드가 모든 published 기술을 평평하게 나열하는 `<select>`로 되어 있다. 기술 수가 늘면서 선택지가 너무 많아져 원하는 기술을 찾기 어렵다. 사이드바처럼 분류(계층 트리)로 볼 수 있게 하거나, 검색으로 바로 찾을 수 있게 개선한다.

## 1. 컴포넌트

### 1.1 `TechniqueParentPicker` (신규, `src/components/ui/TechniqueParentPicker.tsx`)

`SearchModal.tsx`와 같은 전체 화면 오버레이 모달. Props:

```ts
interface TechniqueParentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (technique: { _id: string; name: { ko: string; en?: string } } | null) => void;
  excludeId?: string;   // 수정 모드일 때 현재 편집 중인 기술 자신의 _id
  excludeSlug?: string; // 수정 모드일 때 현재 편집 중인 기술의 slug (하위 기술 제외용)
}
```

- `onSelect(null)`은 "없음 (최상위)" 선택을 의미한다.
- `excludeId`/`excludeSlug`가 없으면(등록 페이지) 아무것도 제외하지 않는다.

### 1.2 트리거 버튼 (기존 `<select>` 자리 교체)

기존 `<select>`를 다음으로 교체한다(등록 페이지, 수정 페이지 양쪽 동일 패턴):

```tsx
<button
  type="button"
  onClick={() => setPickerOpen(true)}
  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
>
  <span className={selectedParentName ? '' : 'text-muted-foreground'}>
    {selectedParentName || '없음 (최상위)'}
  </span>
  <ChevronDown className="h-4 w-4 text-muted-foreground" />
</button>
```

버튼에 표시할 `selectedParentName`은:
- 등록 페이지: 검색/트리에서 선택한 기술의 `name.ko`를 로컬 상태로 들고 있는다(현재 `parentId`만 저장하던 것에 이름도 같이 저장).
- 수정 페이지: 이미 `editForm.parentId`와 별개로 부모 기술의 이름을 표시할 방법이 필요하므로, 마찬가지로 선택 시 이름을 로컬 상태에 저장한다. 최초 진입 시(편집 모드 진입 시)에는 `technique.parentId?.name.ko`(이미 populate되어 있음)를 초기값으로 쓴다.

## 2. 모달 동작

- 상단: 검색 입력창(디바운스 300ms, `SearchModal`/`combo/new`와 동일 패턴) + 닫기 버튼.
- 검색어가 비어 있을 때: 분류 트리를 보여준다. `Sidebar.tsx`의 `renderNode`와 동일한 펼치기/접기(chevron) 방식. 트리 최상단에는 항상 "없음 (최상위)" 항목이 고정으로 보인다.
- 검색어가 있을 때: 트리 대신 `GET /api/techniques?search=...&fields=light` 결과를 평평한 리스트로 보여준다(검색 결과에도 "없음 (최상위)" 항목은 계속 상단에 유지).
- 기술 하나(또는 "없음")를 클릭하면 `onSelect(...)` 호출 후 모달을 닫는다.
- 현재 선택되어 있는 기술은 트리/리스트에서 강조 표시한다(배경색, `Sidebar`의 active 스타일 재사용).

## 3. 데이터 흐름

- **트리 데이터**: 새 API를 추가하지 않는다. 모달이 열릴 때(`isOpen`이 `true`로 바뀔 때) 기존 `GET /api/techniques?fields=light`를 한 번 호출해 전체 목록(`_id name slug parentId pathSlugs primaryRole type order`)을 받아온다.
- **트리 구성**: 받아온 평평한 목록을 `src/lib/technique-service.ts`의 `getTechniqueTree()`와 동일한 알고리즘(parentId 기준 Map + roots 배열)으로 클라이언트에서 직접 트리로 변환한다. 서버 트리를 그대로 재사용하지 않는 이유는, 이 모달은 `status: 'published'` 여부와 무관하게 등록/수정 화면에서 쓰이므로 별도로 필요한 필드만 가벼운 API를 그대로 쓰는 게 기존 패턴(가벼운 `fields=light`)과 맞기 때문이다.
- **검색 데이터**: 기존 `GET /api/techniques?search=...&fields=light`를 그대로 재사용한다.
- **자기/하위 제외**: `excludeId`/`excludeSlug`가 주어지면, 트리를 구성하기 전에 평평한 목록에서 `_id === excludeId`이거나 `pathSlugs.includes(excludeSlug)`인 항목을 전부 제거한다. 검색 결과에도 동일한 필터를 클라이언트에서 한 번 더 적용한다(서버 검색 API 자체는 수정하지 않는다).
- **선택 반영**: `onSelect`로 받은 기술의 `_id`를 `formData.parentId`/`editForm.parentId`에 저장하고, `name.ko`를 트리거 버튼 표시용 로컬 상태에 저장한다. `onSelect(null)`이면 `parentId`를 빈 값으로, 표시용 이름도 비운다.

## 4. 에러 / 빈 상태

- 목록 로딩 실패: 모달 안에 `text-destructive` 배너로 에러 메시지 표시(기존 코드베이스 컨벤션).
- 검색 결과 없음: "검색 결과가 없습니다." (기존 `SearchModal` 문구 재사용).
- 기술이 하나도 없을 때(트리 뷰): "등록된 기술이 없습니다." 안내 문구.

## 5. 적용 범위

- 신규: `src/components/ui/TechniqueParentPicker.tsx`
- 수정: `src/app/technique/new/page.tsx` — `<select>`를 트리거 버튼 + `TechniqueParentPicker`로 교체, 선택된 이름을 표시할 로컬 상태 추가. 기존 `parents` state와 그걸 채우던 `fetchParents` 호출(이 select 전용이었음)은 제거한다.
- 수정: `src/app/technique/[...slug]/page.tsx` — 수정 모드의 `<select>`(579번째 줄 부근)를 동일하게 교체, `excludeId`/`excludeSlug`로 현재 기술 전달. 기존 `allTechniques` state(이 select 전용이었고, `setAllTechniques`가 어디서도 호출되지 않아 항상 빈 배열이었음 — 사실상 동작하지 않던 코드)는 제거한다.

## 6. 범위 밖

- 상위 기술 변경 시 순환 참조를 서버(API) 단에서 검증하는 것은 이번 범위에 포함하지 않는다(UI에서 자기/하위를 안 보이게 하는 것으로 충분하다고 판단).
- 트리에서 여러 기술을 한 번에 관리(순서 변경 등)하는 기능은 포함하지 않는다 — 이 모달은 오직 "상위 기술 하나 선택"용이다.
- 검색 결과 페이지네이션은 다루지 않는다(기존 기술 검색 API들도 페이지네이션 없이 전체 반환하는 패턴을 따른다).
