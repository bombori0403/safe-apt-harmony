-- Post-mitigation risk level (등급) so non-빈도강도법 methods can record an
-- improved-risk result. 빈도강도법 keeps using post_likelihood/post_severity
-- numbers; other methods store an etc level here.
ALTER TABLE public.hazards
  ADD COLUMN post_level public.risk_level;
