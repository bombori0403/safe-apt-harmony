-- Auto-approve new company signups so a trial starts immediately (no wait
-- for a manual approve). The 가입 승인 page stays usable for rejecting/blocking
-- problem orgs after the fact; paid conversion approval comes later with billing.
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
    v_org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', '내 조직');
    INSERT INTO public.organizations (name, subscription_status, seat_limit, expires_at, approval_status)
    VALUES (v_org_name, 'trial', 1000, now() + interval '14 days', 'approved')
    RETURNING id INTO v_org_id;

    INSERT INTO public.users (auth_id, email, name, organization_id, org_role)
    VALUES (
      NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
      v_org_id, 'admin'
    )
    RETURNING id INTO v_user_id;

    UPDATE public.organizations SET created_by = v_user_id WHERE id = v_org_id;

    PERFORM public.create_sample_data_for_user(v_user_id);
  END IF;

  IF lower(NEW.email) = 'ks525@kakao.com' THEN
    UPDATE public.users SET is_platform_admin = true WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END $$;

-- Approve any orgs currently stuck in pending so they can start their trial.
UPDATE public.organizations SET approval_status = 'approved' WHERE approval_status = 'pending';
