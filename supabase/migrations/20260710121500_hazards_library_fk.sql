-- Add the missing FK so PostgREST can embed hazard_library through hazards.library_item_id
-- (needed for the KRAS report's auto-following legal basis join).
ALTER TABLE public.hazards
  ADD CONSTRAINT hazards_library_item_id_fkey
  FOREIGN KEY (library_item_id) REFERENCES public.hazard_library(id) ON DELETE SET NULL;
