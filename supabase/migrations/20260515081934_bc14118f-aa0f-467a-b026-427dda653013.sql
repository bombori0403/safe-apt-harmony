
-- Extend near_miss with structured fields
ALTER TABLE public.near_miss
  ADD COLUMN IF NOT EXISTS location_category text,
  ADD COLUMN IF NOT EXISTS location_detail text,
  ADD COLUMN IF NOT EXISTS incident_type text,
  ADD COLUMN IF NOT EXISTS potential_severity text,
  ADD COLUMN IF NOT EXISTS countermeasure text,
  ADD COLUMN IF NOT EXISTS countermeasure_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_near_miss_updated_at ON public.near_miss;
CREATE TRIGGER update_near_miss_updated_at
BEFORE UPDATE ON public.near_miss
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_near_miss_org_id ON public.near_miss;
CREATE TRIGGER set_near_miss_org_id
BEFORE INSERT ON public.near_miss
FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();

-- Work stop records
CREATE TABLE IF NOT EXISTS public.work_stop_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL,
  assessment_id uuid,
  reported_by uuid,
  exercised_at timestamptz NOT NULL DEFAULT now(),
  exerciser_name text NOT NULL,
  exerciser_position text,
  work_description text NOT NULL,
  stop_reason text NOT NULL,
  result text NOT NULL DEFAULT '작업중단',
  result_detail text,
  reflected_in_assessment boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_stop_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wsr_org_select" ON public.work_stop_records
  FOR SELECT TO authenticated USING (organization_id = current_user_org());
CREATE POLICY "wsr_org_insert" ON public.work_stop_records
  FOR INSERT TO authenticated WITH CHECK (organization_id = current_user_org() AND org_can_write());
CREATE POLICY "wsr_org_update" ON public.work_stop_records
  FOR UPDATE TO authenticated USING (organization_id = current_user_org() AND org_can_write());
CREATE POLICY "wsr_org_delete" ON public.work_stop_records
  FOR DELETE TO authenticated USING (organization_id = current_user_org() AND org_can_write());

CREATE TRIGGER update_wsr_updated_at
BEFORE UPDATE ON public.work_stop_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_wsr_org_id
BEFORE INSERT ON public.work_stop_records
FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();

-- Storage bucket for near-miss photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('near-miss-photos', 'near-miss-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "near_miss_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'near-miss-photos');

CREATE POLICY "near_miss_photos_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'near-miss-photos');

CREATE POLICY "near_miss_photos_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'near-miss-photos');

CREATE POLICY "near_miss_photos_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'near-miss-photos');
