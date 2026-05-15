# 아차사고 · 작업중지권 모듈 구현 계획

산업안전보건법 필수 요소인 두 모듈을 추가합니다. 기존 `near_miss` 테이블이 이미 있으므로 재사용·확장합니다.

## 1. 데이터베이스 마이그레이션

### `near_miss` 테이블 확장 (기존 활용)
기존 컬럼: `situation`, `cause`, `result`, `photos`, `assessment_id`, `complex_id` 등 유지하고 다음 추가:
- `location_category` (text) — 지하주차장/옥상/기계실/저수조/공용계단/엘리베이터/기타
- `location_detail` (text)
- `incident_type` (text) — 전도/추락/끼임/감전/화재/중독/기타
- `potential_severity` (text) — 인적/물적/없음
- `countermeasure` (text)
- `countermeasure_completed` (boolean default false)

### 신규 `work_stop_records` 테이블
- `id`, `organization_id`, `complex_id`, `assessment_id` (nullable), `reported_by`
- `exercised_at`, `exerciser_name`, `exerciser_position`
- `work_description`, `stop_reason`
- `result` (작업재개/작업중단), `result_detail`
- `reflected_in_assessment` (boolean)
- RLS: 조직 단위 select/insert/update/delete (`org_can_write`)

### Storage 버킷
- 신규 버킷 `near-miss-photos` (public) + RLS 업로드 정책

## 2. 신규 페이지 (TanStack Start 라우트)

### 아차사고
- `/_app/near-miss` — 목록 (기간/장소/유형 필터, 최신순)
- `/_app/near-miss.new` — 신고 폼 (모바일 최적화, 사진 업로드 포함)
- `/_app/near-miss.$id` — 상세 + 조치 업데이트

### 작업중지권
- `/_app/work-stop-right` — 산업안전보건법 제52조 안내 (모든 사용자 열람)
- `/_app/work-stop-records` — 행사 기록 목록 + 신규 등록 다이얼로그

## 3. 기존 페이지 수정

### `assessment.new.tsx` (또는 hazards 페이지)
- 상단에 "지난 12개월 아차사고 N건" 카드
- 클릭 시 목록 펼침, 각 항목에 "위험요인으로 등록" 버튼 → `hazards` 테이블에 자동 추가
- 하단에 작업중지권 안내문 블록 (법 제52조 전문, 비상연락망, 동의 체크박스)

### `assessment.$id.report.tsx` (PDF/리포트)
- 마지막 섹션에 작업중지권 안내문 자동 포함

### `app-shell.tsx` (네비게이션)
- "아차사고", "작업중지권" 메뉴 추가 (사이드바 + 모바일 탭바)

## 4. 공통 사항
- 사진은 클라이언트에서 1MB 이하로 리사이즈 후 Supabase Storage 업로드
- 모바일 우선 레이아웃 (큰 터치 타겟, 단일 컬럼)
- 한국어, 법령 명칭 정확히 표기

## 5. 작업 순서
1. DB 마이그레이션 (near_miss 컬럼 추가, work_stop_records 생성, storage 버킷 + 정책)
2. 네비게이션 메뉴 추가
3. 아차사고 신고/목록/상세 페이지 + 사진 압축 유틸
4. 작업중지권 안내/기록 페이지
5. 평가 작성 페이지에 아차사고 카드 + 작업중지권 동의 블록
6. 리포트에 작업중지권 안내문 추가

확인되면 마이그레이션부터 시작합니다.
