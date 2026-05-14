CREATE OR REPLACE FUNCTION public.ensure_current_user_default_complex()
RETURNS TABLE(user_id uuid, complex_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_email text;
  v_name text;
  v_user_id uuid;
  v_complex_id uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT au.email, COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), '사용자')
  INTO v_email, v_name
  FROM auth.users au
  WHERE au.id = v_auth_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  INSERT INTO public.users (auth_id, email, name)
  VALUES (v_auth_id, v_email, v_name)
  ON CONFLICT (auth_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        updated_at = now()
  RETURNING id INTO v_user_id;

  SELECT cm.complex_id
  INTO v_complex_id
  FROM public.complex_members cm
  WHERE cm.user_id = v_user_id
  ORDER BY cm.created_at ASC
  LIMIT 1;

  IF v_complex_id IS NULL THEN
    INSERT INTO public.complexes (name, address, household_count, mgmt_type, manager_name)
    VALUES ('내 단지', '주소를 입력하세요', NULL, '위탁관리', v_name)
    RETURNING id INTO v_complex_id;

    INSERT INTO public.complex_members (complex_id, user_id, role_in_complex)
    VALUES (v_complex_id, v_user_id, '관리사무소장')
    ON CONFLICT (complex_id, user_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_user_id, v_complex_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_current_user_default_complex() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_default_complex() TO authenticated;