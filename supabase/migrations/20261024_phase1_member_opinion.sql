-- 1단계 직원 화면 (2026-10-24)
-- ⚠️ Supabase SQL Editor에서 수동 실행 (크롬 자동번역 OFF). 실행 전에는 직원 의견 제출이 CHECK 제약에 막힌다.
--
-- 1) employee_inputs.input_type 에 'opinion'(직원이 앱에서 보낸 안전 의견) 허용
-- 2) 직원(member)은 employee_inputs 를 본인이 쓴 것만 조회 — 같은 단지 타인의 의견·첨부가 API로 새지 않게
-- 3) 검토 상태(meta.review_status / reviewed_by / reviewed_at)는 관리자·매니저만 바꿀 수 있고,
--    검토자·시각은 서버(트리거)가 정한다 — 직원이 자기 의견을 '반영됨'으로 위조하지 못하게

-- 1) input_type 허용값 확장
ALTER TABLE public.employee_inputs DROP CONSTRAINT IF EXISTS employee_inputs_input_type_check;
ALTER TABLE public.employee_inputs
  ADD CONSTRAINT employee_inputs_input_type_check
  CHECK (input_type IN ('hearing', 'open_chat', 'opinion'));

-- 2) 조회 정책: 관리자·매니저는 기존 범위, 직원은 본인 기록만
DROP POLICY IF EXISTS "view employee_inputs" ON public.employee_inputs;
CREATE POLICY "view employee_inputs"
  ON public.employee_inputs FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (
      (
        public.is_org_manager()
        AND (
          public.is_org_admin()
          OR (complex_id IS NOT NULL AND complex_id IN (SELECT public.user_complex_ids()))
          OR (assessment_id IS NOT NULL AND public.can_access_assessment(assessment_id))
        )
      )
      OR created_by = public.current_user_id()
    )
  );

-- 3) 검토 기록 보호 트리거
CREATE OR REPLACE FUNCTION public.guard_employee_input_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_meta jsonb := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.meta, '{}'::jsonb) ELSE '{}'::jsonb END;
  new_meta jsonb := COALESCE(NEW.meta, '{}'::jsonb);
  review_changed boolean;
BEGIN
  -- 서버(service role) 호출은 JWT가 없다 → 그대로 통과
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  review_changed :=
       (new_meta->>'review_status') IS DISTINCT FROM (old_meta->>'review_status')
    OR (new_meta->>'reviewed_by')   IS DISTINCT FROM (old_meta->>'reviewed_by')
    OR (new_meta->>'reviewed_at')   IS DISTINCT FROM (old_meta->>'reviewed_at');

  IF TG_OP = 'INSERT' THEN
    -- 새 의견은 누구든 '접수됨'에서 시작. 검토자 정보는 비운다.
    NEW.meta := (new_meta - 'reviewed_by' - 'reviewed_at')
                || jsonb_build_object('review_status', COALESCE(new_meta->>'review_status', 'new'));
    IF NOT public.is_org_manager() THEN
      NEW.meta := NEW.meta || jsonb_build_object('review_status', 'new');
    END IF;
    RETURN NEW;
  END IF;

  IF review_changed THEN
    IF NOT public.is_org_manager() THEN
      RAISE EXCEPTION '검토 상태는 관리자·매니저만 변경할 수 있습니다' USING ERRCODE = '42501';
    END IF;
    NEW.meta := new_meta || jsonb_build_object(
      'reviewed_by', public.current_user_id(),
      'reviewed_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_employee_input_review ON public.employee_inputs;
CREATE TRIGGER trg_guard_employee_input_review
  BEFORE INSERT OR UPDATE ON public.employee_inputs
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_input_review();
