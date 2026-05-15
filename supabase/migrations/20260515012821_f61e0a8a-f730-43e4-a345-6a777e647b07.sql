
-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.org_role AS ENUM ('admin','manager','member');
CREATE TYPE public.subscription_status AS ENUM ('trial','active','past_due','canceled');
CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','revoked','expired');

-- ============================================================
-- 2. ORGANIZATIONS
-- ============================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  seat_limit int NOT NULL DEFAULT 5,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. EXTEND USERS
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN org_role public.org_role NOT NULL DEFAULT 'member';

CREATE INDEX idx_users_org ON public.users(organization_id);

-- ============================================================
-- 4. INVITATIONS
-- ============================================================
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. ADD organization_id TO BUSINESS TABLES
-- ============================================================
ALTER TABLE public.complexes
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.assessments
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.near_miss
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_complexes_org ON public.complexes(organization_id);
CREATE INDEX idx_assessments_org ON public.assessments(organization_id);
CREATE INDEX idx_near_miss_org ON public.near_miss(organization_id);

-- ============================================================
-- 6. BACKFILL FROM EXISTING DATA
-- ============================================================

-- 6a. companies → organizations (1:1, preserve id)
INSERT INTO public.organizations (id, name, subscription_status, seat_limit, created_by, created_at)
SELECT id, name, 'trial'::subscription_status, 10, super_admin_user_id, COALESCE(created_at, now())
FROM public.companies
ON CONFLICT (id) DO NOTHING;

-- 6b. super_admin → admin role
UPDATE public.users u
SET organization_id = c.id, org_role = 'admin'
FROM public.companies c
WHERE c.super_admin_user_id = u.id;

-- 6c. complex_members without org → inherit from complex.company_id
UPDATE public.users u
SET organization_id = cx.company_id, org_role = 'member'
FROM public.complex_members cm
JOIN public.complexes cx ON cx.id = cm.complex_id
WHERE cm.user_id = u.id
  AND u.organization_id IS NULL
  AND cx.company_id IS NOT NULL;

-- 6d. Orphan users (no org yet) → create personal org
DO $$
DECLARE r record; new_org uuid;
BEGIN
  FOR r IN SELECT id, name FROM public.users WHERE organization_id IS NULL LOOP
    INSERT INTO public.organizations (name, subscription_status, seat_limit, created_by, expires_at)
    VALUES (r.name || '의 조직', 'trial', 5, r.id, now() + interval '14 days')
    RETURNING id INTO new_org;
    UPDATE public.users SET organization_id = new_org, org_role = 'admin' WHERE id = r.id;
  END LOOP;
END $$;

-- 6e. complexes.organization_id ← company_id, fallback via member
UPDATE public.complexes SET organization_id = company_id WHERE company_id IS NOT NULL AND organization_id IS NULL;
UPDATE public.complexes cx
SET organization_id = u.organization_id
FROM public.complex_members cm
JOIN public.users u ON u.id = cm.user_id
WHERE cm.complex_id = cx.id
  AND cx.organization_id IS NULL
  AND u.organization_id IS NOT NULL;

-- 6f. assessments / near_miss
UPDATE public.assessments a SET organization_id = cx.organization_id
FROM public.complexes cx WHERE cx.id = a.complex_id AND a.organization_id IS NULL;
UPDATE public.near_miss n SET organization_id = cx.organization_id
FROM public.complexes cx WHERE cx.id = n.complex_id AND n.organization_id IS NULL;

-- ============================================================
-- 7. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND org_role = 'admin'
  )
$$;

-- ============================================================
-- 8. AUTO-SET organization_id ON INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_org_id_from_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_user_org();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_complexes_set_org BEFORE INSERT ON public.complexes
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();
CREATE TRIGGER trg_assessments_set_org BEFORE INSERT ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();
CREATE TRIGGER trg_near_miss_set_org BEFORE INSERT ON public.near_miss
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();

-- ============================================================
-- 9. NEW handle_new_user (org admin signup OR invite acceptance)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_org_name text;
  v_signup_type text;
  v_invite_token text;
  v_invite record;
  v_seat_count int;
BEGIN
  v_signup_type := COALESCE(NEW.raw_user_meta_data->>'signup_type', 'org_admin');
  v_invite_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_signup_type = 'invite' AND v_invite_token IS NOT NULL THEN
    -- Invited employee
    SELECT * INTO v_invite FROM public.invitations
    WHERE token::text = v_invite_token AND status = 'pending' AND expires_at > now()
    LIMIT 1;
    IF v_invite IS NULL THEN
      RAISE EXCEPTION '유효하지 않거나 만료된 초대 토큰입니다.';
    END IF;
    IF lower(v_invite.email) <> lower(NEW.email) THEN
      RAISE EXCEPTION '초대된 이메일과 가입 이메일이 일치하지 않습니다.';
    END IF;

    SELECT count(*) INTO v_seat_count FROM public.users WHERE organization_id = v_invite.organization_id;
    IF v_seat_count >= (SELECT seat_limit FROM public.organizations WHERE id = v_invite.organization_id) THEN
      RAISE EXCEPTION '좌석 수 한도를 초과했습니다.';
    END IF;

    INSERT INTO public.users (auth_id, email, name, organization_id, org_role)
    VALUES (
      NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
      v_invite.organization_id, v_invite.role
    )
    RETURNING id INTO v_user_id;

    UPDATE public.invitations SET status = 'accepted', used_at = now() WHERE id = v_invite.id;

  ELSE
    -- Company admin signup
    v_org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', '내 조직');
    INSERT INTO public.organizations (name, subscription_status, seat_limit, expires_at)
    VALUES (v_org_name, 'trial', 5, now() + interval '14 days')
    RETURNING id INTO v_org_id;

    INSERT INTO public.users (auth_id, email, name, organization_id, org_role)
    VALUES (
      NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
      v_org_id, 'admin'
    )
    RETURNING id INTO v_user_id;

    UPDATE public.organizations SET created_by = v_user_id WHERE id = v_org_id;

    -- Sample data only for new admin
    PERFORM public.create_sample_data_for_user(v_user_id);
  END IF;

  RETURN NEW;
END $$;

-- Ensure trigger is wired (was already in place via earlier migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update sample data fn to set organization_id
CREATE OR REPLACE FUNCTION public.create_sample_data_for_user(p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_complex_id uuid; v_assessment_id uuid; v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.users WHERE id = p_user_id;

  INSERT INTO public.complexes (name, address, household_count, mgmt_type, manager_name, organization_id)
  VALUES ('○○아파트 (샘플)','서울특별시 강남구',1200,'위탁관리','홍길동', v_org_id)
  RETURNING id INTO v_complex_id;

  INSERT INTO public.complex_members (complex_id, user_id, role_in_complex)
  VALUES (v_complex_id, p_user_id, '관리사무소장');

  INSERT INTO public.assessments (complex_id, created_by, assessment_type, work_name, work_category, method, assessment_date, status, allowable_level, organization_id)
  VALUES (v_complex_id, p_user_id, '정기평가', '승강기 정기점검','승강기_점검정비','체크리스트법', CURRENT_DATE - INTERVAL '7 days','완료','적정', v_org_id)
  RETURNING id INTO v_assessment_id;
  INSERT INTO public.hazards (assessment_id, description, checklist_result, level, level_standardized) VALUES
    (v_assessment_id,'기계실 진입 시 협착·추락','적정','낮음','낮음'),
    (v_assessment_id,'비상정지 장치 작동 확인','보완','보통','보통');

  RETURN v_complex_id;
END $$;

-- ============================================================
-- 10. RLS POLICIES — REPLACE WITH ORG-ISOLATED VERSIONS
-- ============================================================

-- complexes
DROP POLICY IF EXISTS complexes_insert ON public.complexes;
DROP POLICY IF EXISTS complexes_member_select ON public.complexes;
DROP POLICY IF EXISTS complexes_update ON public.complexes;
CREATE POLICY complexes_org_select ON public.complexes FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org());
CREATE POLICY complexes_org_insert ON public.complexes FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_org());
CREATE POLICY complexes_org_update ON public.complexes FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org());
CREATE POLICY complexes_org_delete ON public.complexes FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org() AND public.is_org_admin());

-- assessments
DROP POLICY IF EXISTS assessments_member_all ON public.assessments;
CREATE POLICY assessments_org_all ON public.assessments FOR ALL TO authenticated
  USING (organization_id = public.current_user_org())
  WITH CHECK (organization_id = public.current_user_org());

-- near_miss
DROP POLICY IF EXISTS near_miss_via_complex ON public.near_miss;
CREATE POLICY near_miss_org_all ON public.near_miss FOR ALL TO authenticated
  USING (organization_id = public.current_user_org())
  WITH CHECK (organization_id = public.current_user_org());

-- can_access_assessment helper: replace with org-based check
CREATE OR REPLACE FUNCTION public.can_access_assessment(_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments
    WHERE id = _assessment_id AND organization_id = public.current_user_org()
  )
$$;

-- users: same-org members can view each other; self/admin can update
DROP POLICY IF EXISTS users_self_select ON public.users;
DROP POLICY IF EXISTS users_self_update ON public.users;
DROP POLICY IF EXISTS users_insert_self ON public.users;
CREATE POLICY users_org_select ON public.users FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR organization_id = public.current_user_org());
CREATE POLICY users_self_update ON public.users FOR UPDATE TO authenticated
  USING (auth_id = auth.uid());
CREATE POLICY users_admin_update ON public.users FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org() AND public.is_org_admin());
CREATE POLICY users_admin_delete ON public.users FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org() AND public.is_org_admin() AND auth_id <> auth.uid());
CREATE POLICY users_insert_self ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- organizations
CREATE POLICY orgs_member_select ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_user_org());
CREATE POLICY orgs_admin_update ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_user_org() AND public.is_org_admin());

-- invitations: only org admins
CREATE POLICY invitations_admin_select ON public.invitations FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org() AND public.is_org_admin());
CREATE POLICY invitations_admin_insert ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_org() AND public.is_org_admin());
CREATE POLICY invitations_admin_update ON public.invitations FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org() AND public.is_org_admin());
CREATE POLICY invitations_admin_delete ON public.invitations FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org() AND public.is_org_admin());

-- ============================================================
-- 11. PUBLIC RPC: validate invitation token (anonymous, for /invite page)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_invitation(_token text)
RETURNS TABLE(email text, organization_name text, role public.org_role, valid boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv record;
BEGIN
  SELECT i.*, o.name AS org_name INTO v_inv
  FROM public.invitations i JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token::text = _token LIMIT 1;
  IF v_inv IS NULL THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::org_role, false, '존재하지 않는 초대입니다.';
    RETURN;
  END IF;
  IF v_inv.status <> 'pending' THEN
    RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, false, '이미 사용되었거나 취소된 초대입니다.';
    RETURN;
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, false, '만료된 초대입니다.';
    RETURN;
  END IF;
  RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, true, NULL::text;
END $$;
GRANT EXECUTE ON FUNCTION public.validate_invitation(text) TO anon, authenticated;
