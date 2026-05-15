
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users u ON u.auth_id = au.id
    WHERE u.id IS NULL
  LOOP
    BEGIN
      PERFORM public.handle_new_user_for_existing(r.id, r.email, r.raw_user_meta_data);
    EXCEPTION WHEN undefined_function THEN
      -- inline minimal recovery
      DECLARE
        v_invite record; v_user_id uuid; v_org_id uuid; v_target_complex uuid;
        v_signup_type text; v_invite_token text;
      BEGIN
        v_signup_type := COALESCE(r.raw_user_meta_data->>'signup_type', 'org_admin');
        v_invite_token := r.raw_user_meta_data->>'invitation_token';
        IF v_signup_type = 'invite' AND v_invite_token IS NOT NULL THEN
          SELECT * INTO v_invite FROM public.invitations WHERE token::text = v_invite_token LIMIT 1;
          IF v_invite IS NOT NULL THEN
            INSERT INTO public.users (auth_id, email, name, organization_id, org_role)
            VALUES (r.id, r.email, COALESCE(r.raw_user_meta_data->>'name', split_part(r.email,'@',1)),
                    v_invite.organization_id, v_invite.role)
            RETURNING id INTO v_user_id;
            v_target_complex := v_invite.complex_id;
            IF v_target_complex IS NOT NULL THEN
              IF v_invite.role = 'manager' THEN
                UPDATE public.users SET org_role = 'member'
                WHERE org_role = 'manager' AND organization_id = v_invite.organization_id
                  AND id IN (SELECT cm.user_id FROM public.complex_members cm WHERE cm.complex_id = v_target_complex)
                  AND id <> v_user_id;
              END IF;
              INSERT INTO public.complex_members (complex_id, user_id, role_in_complex)
              VALUES (v_target_complex, v_user_id,
                CASE WHEN v_invite.role='manager' THEN '관리사무소장'::user_role ELSE '기타'::user_role END)
              ON CONFLICT DO NOTHING;
            END IF;
            IF v_invite.is_link THEN
              UPDATE public.invitations SET used_count = used_count + 1 WHERE id = v_invite.id;
            ELSE
              UPDATE public.invitations SET status = 'accepted', used_at = now() WHERE id = v_invite.id;
            END IF;
          END IF;
        END IF;
      END;
    END;
  END LOOP;
END $$;
