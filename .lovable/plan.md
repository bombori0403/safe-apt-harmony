# B2B SaaS 멀티테넌시 전환 계획

현재는 `companies` + `complexes` + `complex_members` 구조로 "회사 슈퍼 관리자 / 단지 멤버" 권한이 분산되어 있어요. 이걸 **조직(organization) 단위 멀티테넌시**로 통합하고, 모든 업무 데이터를 조직 경계로 격리합니다.

---

## 1. 데이터베이스 스키마 변경

### (A) 신규 테이블

**`organizations`** — 테넌트(회사 = 조직) 단위
- `id`, `name`, `slug`(선택), `subscription_status`(`trial`/`active`/`past_due`/`canceled`), `seat_limit`(int), `expires_at`(timestamptz), `created_by`(users.id), timestamps

**`invitations`** — 초대 토큰
- `id`, `token`(uuid, unique), `email`, `organization_id`, `role`(`admin`/`manager`/`member`), `invited_by`, `expires_at`, `used_at`, `created_at`
- 인덱스: `(token)`, `(organization_id, email)`

### (B) `users` 테이블 확장
- `organization_id uuid` (nullable 초기, 마이그레이션 후 NOT NULL)
- `org_role` enum (`admin`/`manager`/`member`) — 기존 `role`은 유지(직책 호환), 권한용은 `org_role`로 분리

### (C) 모든 업무 테이블에 `organization_id` 추가
- `complexes`, `assessments`, `hazards`(상속), `measures`(상속), `participants`(상속), `signatures`(상속), `near_miss`
- 자식 테이블은 직접 컬럼 추가 대신 부모 통한 RLS로도 가능하지만, **격리 명확성과 인덱스 성능**을 위해 직접 컬럼 추가 권장
- 신규 row 자동 채움 트리거: `BEFORE INSERT`에서 `current_user_id()`의 `organization_id`로 세팅

---

## 2. RLS 정책 (조직 격리)

핵심 원칙: **모든 업무 데이터는 `organization_id = current_user_org()` 일치 시에만 접근**

- 헬퍼 함수 `current_user_org()` `SECURITY DEFINER` 추가
- 헬퍼 함수 `is_org_admin()` 추가
- 정책 재작성:
  - `organizations`: SELECT — 자기 조직만; UPDATE — `is_org_admin()`만
  - `users`: SELECT — 같은 조직 멤버 모두 보기 가능; UPDATE — 본인 또는 admin
  - `invitations`: SELECT/INSERT/DELETE — admin만 (같은 조직)
  - `complexes`/`assessments`/그 외: `organization_id = current_user_org()`
- 기존 `complex_members` 기반 정책은 **제거** (조직 단위로 단순화)

---

## 3. 회원가입 흐름 분리

### (A) `/signup` — 회사 대표 가입
1. 이메일/비밀번호 + 회사명 입력
2. Supabase `signUp` → `handle_new_user` 트리거 수정:
   - `organizations` insert (회사명, `subscription_status='trial'`, `expires_at = now()+14일`)
   - `users` insert with `organization_id`, `org_role='admin'`

### (B) `/invite/:token` — 초대받은 직원 가입
1. 토큰으로 `invitations` 조회 → `expires_at > now()` && `used_at IS NULL` 검증
2. 이메일은 초대 메일 주소로 **lock**, 비밀번호만 입력
3. 가입 후 트리거가 토큰의 `organization_id`/`role`을 사용해 `users` row 생성
4. `invitations.used_at = now()` 마킹
5. 토큰은 `auth.signUp`의 `options.data.invitation_token`으로 전달 → 트리거에서 읽음

기존 `/signup`(범용 가입)은 제거하거나 (A)로 대체.

---

## 4. 직원 관리 페이지 (`/_app/team`, admin 전용)

- 라우트 가드: `org_role !== 'admin'`이면 dashboard로 리다이렉트
- 기능:
  - **초대 발송**: 이메일 + 역할 선택 → `invitations` insert + 초대 메일 전송 (Lovable 트랜잭셔널 이메일, 별도 단계 필요 — 일단 토큰 링크 표시 + 복사 버튼으로 시작, 이메일 발송은 후속 작업으로 권장)
  - **직원 목록**: 같은 조직 users 표시 (이름/이메일/역할/가입일)
  - **역할 변경**: admin/manager/member 토글
  - **삭제**: `users` soft delete 또는 auth.users 제거 (admin RPC 필요)
  - **좌석 카운트**: `users 수 / seat_limit` 표시, 초과 시 초대 버튼 비활성화
  - **대기 초대**: 미사용 invitations 목록 + 재발송/취소

---

## 5. 기존 데이터 마이그레이션 전략

현재 데이터:
- `companies` ≈ 조직 / `complexes` ≈ 단지 / `complex_members` ≈ 멤버십
- `users.role` (`기타` 등) — 이건 직책 의미라 보존

**1단계 — 스키마 추가 (비파괴)**
- `organizations`, `invitations` 생성
- 모든 테이블에 `organization_id` nullable 추가

**2단계 — 데이터 백필**
```sql
-- companies → organizations 1:1 변환
INSERT INTO organizations (id, name, subscription_status, seat_limit, created_by)
SELECT id, name, 'trial', 5, super_admin_user_id FROM companies;

-- users 백필: super_admin은 admin, complex_members는 member
UPDATE users u SET organization_id = c.id, org_role='admin'
FROM companies c WHERE c.super_admin_user_id = u.id;

UPDATE users u SET organization_id = cx.company_id, org_role = COALESCE(u.org_role,'member')
FROM complex_members cm JOIN complexes cx ON cx.id=cm.complex_id
WHERE cm.user_id = u.id AND u.organization_id IS NULL AND cx.company_id IS NOT NULL;

-- 고아 사용자(샘플 데이터로 만든 단지에 회사 없는 케이스): 본인 조직 신규 생성
WITH orphans AS (SELECT id, name FROM users WHERE organization_id IS NULL),
ins AS (INSERT INTO organizations (name, subscription_status, seat_limit, created_by)
        SELECT name||'의 조직','trial',5,id FROM orphans RETURNING id, created_by)
UPDATE users u SET organization_id = ins.id, org_role='admin' FROM ins WHERE u.id = ins.created_by;

-- complexes/assessments/near_miss organization_id 백필
UPDATE complexes SET organization_id = company_id WHERE company_id IS NOT NULL;
UPDATE complexes cx SET organization_id = (SELECT u.organization_id FROM complex_members cm JOIN users u ON u.id=cm.user_id WHERE cm.complex_id=cx.id LIMIT 1) WHERE organization_id IS NULL;

UPDATE assessments a SET organization_id = cx.organization_id FROM complexes cx WHERE cx.id=a.complex_id;
-- hazards/measures/participants/signatures: assessment 통해 백필
```

**3단계 — 제약 강화**
- `organization_id NOT NULL` 적용
- BEFORE INSERT 트리거로 자동 세팅
- 기존 RLS 정책 DROP, 신규 조직 격리 정책 CREATE

**4단계 — 코드 마이그레이션**
- `handle_new_user` 트리거 재작성 (raw_user_meta_data에서 `signup_type`, `org_name`, `invitation_token` 읽기)
- 모든 쿼리에서 `complex_members` 의존 제거
- `auth-middleware`나 user-context에서 `organization_id`, `org_role` 노출

**5단계 — 클린업 (선택, 다음 릴리스)**
- `companies`, `complex_members` 테이블 제거
- `users.role`은 직책으로 유지

---

## 6. UI/라우팅 변경

- `/signup` (대표) / `/invite/$token` (직원) 신규
- 기존 `/login` 유지
- `/_app/team` 신규 (admin)
- 사이드바: admin에게만 "직원 관리" 메뉴 노출
- `/_app/settings`: 조직 정보 + 구독 상태 표시
- 모든 데이터 페이지는 자동으로 RLS에 의해 조직 데이터만 보임 (코드 변경 최소)

---

## 7. 보안 체크리스트

- 초대 토큰: UUID v4, 7일 만료, 1회용
- `invitations` SELECT 정책: admin만 (토큰 노출 방지). 가입 시 검증은 `SECURITY DEFINER` RPC `accept_invitation(token, password)`로 처리
- 역할 변경: admin이 자기 자신을 강등 못하게 가드 (마지막 admin 보호)
- `seat_limit` 초과 시 초대/가입 차단 (RPC에서 검증)
- 만료 조직(`expires_at < now()` && status != active): RLS에서 읽기는 허용, 쓰기는 차단

---

## 기술 세부 (개발자용)

**필요 작업 (구현 순서)**
1. 마이그레이션 1: 신규 테이블 + 컬럼 추가 (nullable)
2. 마이그레이션 2: 데이터 백필 (위 SQL)
3. 마이그레이션 3: NOT NULL + 트리거 + RLS 재작성 + `accept_invitation` RPC
4. 코드: `user-context`에 `organization_id`/`org_role` 추가
5. 라우트: `/signup` 재작성, `/invite/$token` 신규, `/_app/team` 신규
6. 사이드바 admin 가드
7. `handle_new_user` 트리거 업데이트 (대표 가입 시 조직 생성, 초대 토큰 처리)

**리스크**
- `handle_new_user`가 자동으로 샘플 데이터를 만들고 있음 → 신규 회사 대표 가입에만 유지, 초대 가입 시엔 skip
- 기존 사용자의 세션은 트리거/스키마 변경 후 재로그인 필요할 수 있음
- 이메일 초대 발송 인프라는 별도 (먼저 토큰 링크 복사 방식으로 시작 권장)

---

**진행 방식 제안**
변경 범위가 크고 데이터 마이그레이션이 들어가서 한 번에 다 적용하면 위험합니다. 다음 중 하나로 시작할까요?

1. **A안 (한 번에 전체)**: 위 1~7 모두 한 PR로. 빠르지만 롤백 어려움.
2. **B안 (단계 분할, 권장)**: 먼저 스키마 + 백필 + 신규 가입 흐름까지 (1~5)만 적용 → 동작 확인 → 그 다음 직원 관리 UI + 초대 메일 (6~7).
3. **C안 (이메일 초대 빼고)**: 1~6 모두 적용, 단 초대는 "링크 복사 후 직접 전달" 방식으로 시작. 이메일 발송은 후속.

어떤 안으로 갈지 알려주세요.