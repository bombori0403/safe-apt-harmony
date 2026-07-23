-- 초대 가입 트리거 복구 — Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
-- 20260710190000에서 handle_new_user를 재작성할 때 초대 처리 로직이 누락됐다:
--   ① 매니저/멤버 초대 시 complex_members 배정이 빠져 "소속 단지 미배정" 상태가 됨
--   ② 매니저 초대 시 기존 매니저 강등이 빠짐
--   ③ 다회용 QR 링크(is_link)를 첫 사용 후 status='accepted'로 만들어 2번째부터 막힘
-- 아래에서 이 세 가지를 복구한다(자동승인·좌석검사·플랫폼관리자·샘플데이터는 그대로 유지).

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
    -- 링크(is_link)는 status가 계속 'pending'이며 used_count로 관리한다.
    SELECT * INTO v_invite FROM public.invitations
    WHERE token::text = v_invite_token
      AND status = 'pending'
      AND expires_at > now()
      AND (NOT is_link OR max_uses IS NULL OR used_count < max_uses)
    LIMIT 1;
    IF v_invite IS NULL THEN
      RAISE EXCEPTION '유효하지 않거나 만료된 초대 토큰입니다.';
    END IF;
    -- 단일 초대만 이메일 일치를 검사한다(링크 초대는 이메일이 비어 있음).
    IF NOT v_invite.is_link AND v_invite.email IS NOT NULL AND v_invite.email <> ''
       AND lower(v_invite.email) <> lower(NEW.email) THEN
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

    -- 단지 배정(+ 매니저면 해당 단지의 기존 매니저를 일반으로 강등)
    IF v_invite.complex_id IS NOT NULL THEN
      IF v_invite.role = 'manager' THEN
        UPDATE public.users SET org_role = 'member'
        WHERE org_role = 'manager' AND organization_id = v_invite.organization_id
          AND id IN (SELECT cm.user_id FROM public.complex_members cm WHERE cm.complex_id = v_invite.complex_id)
          AND id <> v_user_id;
      END IF;
      INSERT INTO public.complex_members (complex_id, user_id, role_in_complex)
      VALUES (v_invite.complex_id, v_user_id,
        CASE WHEN v_invite.role = 'manager' THEN '관리사무소장'::user_role ELSE '기타'::user_role END)
      ON CONFLICT DO NOTHING;
    END IF;

    -- 링크는 사용횟수 증가, 단일 초대는 수락 처리
    IF v_invite.is_link THEN
      UPDATE public.invitations SET used_count = used_count + 1 WHERE id = v_invite.id;
    ELSE
      UPDATE public.invitations SET status = 'accepted', used_at = now() WHERE id = v_invite.id;
    END IF;

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
