
-- Add complex scope to invitations
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS complex_id uuid NULL;

-- Helper: get current user's primary complex (for manager scoping)
CREATE OR REPLACE FUNCTION public.current_user_complex()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT cm.complex_id
  FROM public.complex_members cm
  JOIN public.users u ON u.id = cm.user_id
  WHERE u.auth_id = auth.uid()
  LIMIT 1
$$;

-- Check if user is a manager
CREATE OR REPLACE FUNCTION public.is_org_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND org_role IN ('admin','manager')
  )
$$;

-- Allow managers to read invitations of their org (for listing) and update/insert/delete with rules
DROP POLICY IF EXISTS invitations_admin_select ON public.invitations;
DROP POLICY IF EXISTS invitations_admin_insert ON public.invitations;
DROP POLICY IF EXISTS invitations_admin_update ON public.invitations;
DROP POLICY IF EXISTS invitations_admin_delete ON public.invitations;

CREATE POLICY invitations_org_select ON public.invitations FOR SELECT TO authenticated
  USING (organization_id = current_user_org() AND (is_org_admin() OR is_org_manager()));
CREATE POLICY invitations_admin_insert ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_user_org() AND is_org_admin());
CREATE POLICY invitations_admin_update ON public.invitations FOR UPDATE TO authenticated
  USING (organization_id = current_user_org() AND is_org_admin());
CREATE POLICY invitations_admin_delete ON public.invitations FOR DELETE TO authenticated
  USING (organization_id = current_user_org() AND is_org_admin());

-- Updated handle_new_user with complex linking + 1-manager-per-complex enforcement
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user_id uuid; v_org_id uuid; v_org_name text;
  v_signup_type text; v_invite_token text; v_invite record; v_seat_count int;
  v_target_complex uuid;
BEGIN
  v_signup_type := COALESCE(NEW.raw_user_meta_data->>'signup_type', 'org_admin');
  v_invite_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_signup_type = 'invite' AND v_invite_token IS NOT NULL THEN
    SELECT * INTO v_invite FROM public.invitations
      WHERE token::text = v_invite_token AND expires_at > now() LIMIT 1;
    IF v_invite IS NULL THEN RAISE EXCEPTION '유효하지 않거나 만료된 초대 토큰입니다.'; END IF;

    IF v_invite.is_link THEN
      IF v_invite.status = 'revoked' THEN RAISE EXCEPTION '취소된 초대 링크입니다.'; END IF;
      IF v_invite.max_uses IS NOT NULL AND v_invite.used_count >= v_invite.max_uses THEN
        RAISE EXCEPTION '사용 횟수가 모두 소진된 링크입니다.';
      END IF;
    ELSE
      IF v_invite.status <> 'pending' THEN RAISE EXCEPTION '이미 사용되었거나 취소된 초대입니다.'; END IF;
      IF lower(v_invite.email) <> lower(NEW.email) THEN
        RAISE EXCEPTION '초대된 이메일과 가입 이메일이 일치하지 않습니다.';
      END IF;
    END IF;

    SELECT count(*) INTO v_seat_count FROM public.users WHERE organization_id = v_invite.organization_id;
    IF v_seat_count >= (SELECT seat_limit FROM public.organizations WHERE id = v_invite.organization_id) THEN
      RAISE EXCEPTION '좌석 수 한도를 초과했습니다.';
    END IF;

    INSERT INTO public.users (auth_id, email, name, organization_id, org_role)
    VALUES (NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
      v_invite.organization_id, v_invite.role)
    RETURNING id INTO v_user_id;

    -- Link to complex
    v_target_complex := v_invite.complex_id;
    IF v_target_complex IS NOT NULL THEN
      -- For manager invite: demote existing manager(s) of this complex to member
      IF v_invite.role = 'manager' THEN
        UPDATE public.users SET org_role = 'member'
        WHERE org_role = 'manager'
          AND organization_id = v_invite.organization_id
          AND id IN (
            SELECT cm.user_id FROM public.complex_members cm
            WHERE cm.complex_id = v_target_complex
          )
          AND id <> v_user_id;
      END IF;
      INSERT INTO public.complex_members (complex_id, user_id, role_in_complex)
      VALUES (v_target_complex, v_user_id, CASE WHEN v_invite.role='manager' THEN '관리사무소장'::user_role ELSE '기타'::user_role END)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_invite.is_link THEN
      UPDATE public.invitations SET used_count = used_count + 1 WHERE id = v_invite.id;
    ELSE
      UPDATE public.invitations SET status = 'accepted', used_at = now() WHERE id = v_invite.id;
    END IF;
  ELSE
    v_org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', '내 조직');
    INSERT INTO public.organizations (name, subscription_status, seat_limit, expires_at)
    VALUES (v_org_name, 'trial', 5, now() + interval '14 days')
    RETURNING id INTO v_org_id;
    INSERT INTO public.users (auth_id, email, name, organization_id, org_role)
    VALUES (NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
      v_org_id, 'admin')
    RETURNING id INTO v_user_id;
    UPDATE public.organizations SET created_by = v_user_id WHERE id = v_org_id;
    PERFORM public.create_sample_data_for_user(v_user_id);
  END IF;
  RETURN NEW;
END $$;
