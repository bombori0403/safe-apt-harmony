
ALTER TABLE public.complexes ADD COLUMN IF NOT EXISTS initial_assessment_date DATE;
ALTER TABLE public.complexes ADD COLUMN IF NOT EXISTS next_assessment_auto DATE;

CREATE OR REPLACE FUNCTION public.recompute_next_assessment(_complex_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_last DATE; v_initial DATE; v_next DATE;
BEGIN
  SELECT max(assessment_date) INTO v_last
    FROM public.assessments
    WHERE complex_id = _complex_id
      AND assessment_type = '정기평가'
      AND status = '완료';
  SELECT initial_assessment_date INTO v_initial FROM public.complexes WHERE id = _complex_id;
  IF v_last IS NOT NULL THEN v_next := v_last + INTERVAL '1 year';
  ELSIF v_initial IS NOT NULL THEN v_next := v_initial + INTERVAL '1 year';
  ELSE v_next := NULL;
  END IF;
  UPDATE public.complexes SET next_assessment_auto = v_next WHERE id = _complex_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_assessments_recompute_next()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_next_assessment(OLD.complex_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_next_assessment(NEW.complex_id);
  IF TG_OP='UPDATE' AND OLD.complex_id IS DISTINCT FROM NEW.complex_id THEN
    PERFORM public.recompute_next_assessment(OLD.complex_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assessments_next_after ON public.assessments;
CREATE TRIGGER trg_assessments_next_after
AFTER INSERT OR UPDATE OR DELETE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.trg_assessments_recompute_next();

CREATE OR REPLACE FUNCTION public.trg_complexes_recompute_next()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.recompute_next_assessment(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complexes_next_after ON public.complexes;
CREATE TRIGGER trg_complexes_next_after
AFTER INSERT OR UPDATE OF initial_assessment_date ON public.complexes
FOR EACH ROW EXECUTE FUNCTION public.trg_complexes_recompute_next();

-- Backfill existing complexes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.complexes LOOP
    PERFORM public.recompute_next_assessment(r.id);
  END LOOP;
END $$;
