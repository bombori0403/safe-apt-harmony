# 안전데스크 (safe-apt-harmony)

공동주택(임대주택) 관리사무소용 **위험성평가 SaaS**. 원래 Lovable로 만들었고 현재 Claude Code + GitHub로 독립 운영.

- 브랜드명: **안전데스크** (로고: `public/logo-mark.png`, 원본 `brand/logo-source.png`)
- 스택: React 19, TanStack Start/Router(파일 기반 라우트), Supabase(Postgres+RLS+Storage), Tailwind v4 + shadcn/ui, Pretendard
- 배포: Cloudflare Workers → `https://tanstack-start-app.anjeondesk.workers.dev`

## 빌드 · 배포 (매번 이 순서)
```bash
npx vite build
npx wrangler deploy --config .output/server/wrangler.json
git add -A && git commit -m "..." && git push origin main   # main 브랜치
```
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- 셸은 Git Bash(POSIX). tsc에 기존 오류가 있으나 `vite build`(esbuild)는 무시하고 성공하면 OK.

## 인프라 · 비밀키
- Supabase 프로젝트: `tcchzumelgqrwiyuppdo`
- `.env` (git 추적): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`(=anon, 공개 OK) + VITE_ 변형
- `.env.local` (git 무시, `*.local`): `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SIGNUP_NOTIFY_EMAIL=get0412@gmail.com`
- 서비스롤 키는 서버 전용(`src/integrations/supabase/client.server.ts`, `*.functions.ts`)에서만 사용
- 플랫폼(서버) 관리자 계정: **ks525@kakao.com** (users.is_platform_admin)

## 마이그레이션 (중요)
- `supabase/migrations/*.sql` 를 **사용자가 Supabase SQL Editor에서 수동 실행**한다 (CLI 자동적용 아님).
- ⚠️ 실행 시 **크롬 자동번역 OFF** (켜면 대시보드가 `removeChild` 오류로 깨짐).
- 타입은 자동생성 스크립트 없음 → `src/integrations/supabase/types.ts`를 **수동 편집**해왔음.
- 새 마이그레이션을 만들면 "이 SQL을 SQL Editor에서 실행하세요"라고 사용자에게 안내할 것.

## 핵심 컨벤션 / 함정
- **단지 목록 로딩**: 관리자(`org_role==='admin'`)는 `complexes` 전체(RLS가 조직별 제한), 그 외는 `complex_members`로 필터. complex_members만 쓰면 관리자 목록이 비는 버그가 반복됨.
- **사진**: 버킷(`assessment-photos`, `near-miss-photos`)은 **비공개**. 표시는 항상 `<SignedImg>`(`src/components/signed-img.tsx`) + `getSignedUrl`(`src/lib/storage.ts`). 인쇄 섹션의 `<img>`도 SignedImg여야 함. `getPublicUrl`은 저장만 하고 표시엔 서명URL 사용.
- **체험 잠금**: `org_can_write()`가 `subscription_status IN('trial','active') AND (expires_at IS NULL OR expires_at>now())` 로 모든 쓰기를 게이트. 만료 후엔 워터마크(`TrialWatermark`) + 하드락(`TrialExpiredBlock`).
  - UPDATE/DELETE가 정책으로 막히면 에러 없이 0행 → `.select()`로 행수 확인해 거짓 성공 방지.
  - RLS 오류는 `writeErrorMessage()`(`src/lib/write-error.ts`)로 사용자 친화 문구.
- 구독/결제 컬럼(subscription_status/expires_at/seat_limit)은 **플랫폼 관리자만** 변경 가능(트리거 `guard_org_billing_columns`).
- 평가방법 5종 모두 지원: 빈도강도법·3단계·5단계·체크리스트·OPS. KRAS 표(`kras-report-table.tsx`)는 `_method`로 행별 표기 분기.
- 위험도 등급 값: `매우낮음/낮음/보통/높음/매우높음` + (3단계 상/중/하, 체크리스트 적정/보완). `RISK_ORDER`(`src/lib/types.ts`)에 전부 매핑됨.

## 주요 기능 (구현됨)
- 가입/온보딩: 간편가입(단지명·이메일·비번) → 즉시 14일 체험. 14일 후 `/activate`에서 정식 등록 신청 → 플랫폼 관리자 승인(`/platform-admin`)으로 `active` 전환. 관리자는 체험 중에도 즉시 활성화 가능.
- 위험성평가 흐름: 새 평가(`/assessment/new`) → 유해위험요인(`/hazards`) → 위험성결정(`/results`) → 감소대책(`/measures`) → 협의·공유(`/share`) → 결과서(`/report`). 평가 상세에 진행 스텝퍼.
- 유해위험요인 라이브러리: 표준서식 실데이터에서 587건 시드(조문·빈도강도·대표대책 포함). 선택 시 자동 채움.
- 법적기준 자동매칭: `src/lib/legal-basis-keywords.ts` + hazard_library.article_no/legal_basis.
- 출력: KRAS 양식(개별 `/kras-report`, 전체 `/kras-report-all`), 문서 출력 센터(`/print-all` — 실시규정/KRAS/아차사고/작업중지/청취/오픈 체크박스 선택, 한 PDF).
- 실시규정(`/regulation`): 편집형. 기본문구의 `{{사업장}}`이 단지명으로 자동 치환(`resolveOrgTokens`), 맨 위 사업장명 바꾸면 본문 연동.
- 엑셀 가져오기(`/import`): 표준서식 파싱(`src/lib/xlsx-import.ts`, SheetJS) → 평가 자동 생성.
- 과년도 재검토: 새 평가에서 이전 평가 선택 시 위험요인·대책 전체 복사(완료/미완료 유지).
- 단지 관리: `/complexes`(사이드바 메뉴) — `ComplexManager` 컴포넌트. 단지 등록·수정·삭제. (설정에는 링크만)
- 부가: 아차사고(`/near-miss`), 작업중지권(`/work-stop-right`), 직원참여(`/employee-inputs`), 본사콘솔(`/console`), 직원관리(`/team`), 엑셀 내보내기(대시보드), 개인정보처리방침(`/privacy`).

## 체험판 제한
- 단지 1개, 평가 10건, 모든 출력에 워터마크, 14일 후 쓰기 잠금.

## 사용자(고객) 특성
- 비개발자(공동주택 관리사무소). 마이그레이션은 직접 SQL Editor에서 실행. 한국어로 소통. 파일 열기/저장 등 기본 안내 필요할 수 있음.

## 알려진 정리거리 (급하지 않음)
- `src/routes/_app/settings.tsx`에 단지관리 이전 코드 일부가 미사용으로 남음(동작 무해).
- xlsx(0.18.5)는 알려진 취약점 있으나 사용자 본인 파일만 파싱 → 위험 낮음.
- 이메일 인증은 현재 꺼둠(가입 마찰↓). 비밀번호 최소 6자.
