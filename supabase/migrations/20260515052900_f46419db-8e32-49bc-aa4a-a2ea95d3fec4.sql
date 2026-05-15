
ALTER TABLE public.invitations
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label text;

DROP FUNCTION IF EXISTS public.validate_invitation(text);

CREATE OR REPLACE FUNCTION public.validate_invitation(_token text)
RETURNS TABLE(email text, organization_name text, role org_role, valid boolean, reason text, is_link boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_inv record;
BEGIN
  SELECT i.*, o.name AS org_name INTO v_inv
  FROM public.invitations i JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token::text = _token LIMIT 1;
  IF v_inv IS NULL THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::org_role, false, '존재하지 않는 초대입니다.', false; RETURN;
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, false, '만료된 초대입니다.', v_inv.is_link; RETURN;
  END IF;
  IF v_inv.is_link THEN
    IF v_inv.status = 'revoked' THEN
      RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, false, '취소된 링크입니다.', true; RETURN;
    END IF;
    IF v_inv.max_uses IS NOT NULL AND v_inv.used_count >= v_inv.max_uses THEN
      RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, false, '사용 횟수가 모두 소진되었습니다.', true; RETURN;
    END IF;
    RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, true, NULL::text, true; RETURN;
  ELSE
    IF v_inv.status <> 'pending' THEN
      RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, false, '이미 사용되었거나 취소된 초대입니다.', false; RETURN;
    END IF;
    RETURN QUERY SELECT v_inv.email, v_inv.org_name, v_inv.role, true, NULL::text, false; RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid; v_org_id uuid; v_org_name text;
  v_signup_type text; v_invite_token text; v_invite record; v_seat_count int;
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
