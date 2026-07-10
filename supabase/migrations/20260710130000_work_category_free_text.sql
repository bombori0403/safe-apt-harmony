-- Work category on assessments was restricted to a fixed 9-value enum, but
-- real facility-management work is far broader. Loosen it to free text so
-- users can type any category; hazard_library.category (curated presets)
-- keeps the enum since its suggestions are still keyed to the fixed set.
ALTER TABLE public.assessments
  ALTER COLUMN work_category TYPE text USING work_category::text;
