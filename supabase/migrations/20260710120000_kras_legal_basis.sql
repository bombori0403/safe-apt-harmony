-- KRAS-format report support: legal basis on hazard_library (auto-follow),
-- fallback override + post-mitigation numeric risk on hazards.

ALTER TABLE public.hazard_library
  ADD COLUMN article_no TEXT,
  ADD COLUMN legal_basis TEXT;

ALTER TABLE public.hazards
  ADD COLUMN legal_basis_override TEXT,
  ADD COLUMN post_likelihood INT,
  ADD COLUMN post_severity INT;

-- Seed legal basis onto existing hazard_library rows by keyword match.
-- Heuristic mapping, not a legal accuracy guarantee — review before relying on it.
UPDATE public.hazard_library SET article_no='제34조', legal_basis='산업안전보건기준에 관한 규칙 제34조(전용보호구 등)'
  WHERE article_no IS NULL AND (description LIKE '%보호구%' OR description LIKE '%미착용%');

UPDATE public.hazard_library SET article_no='제302조', legal_basis='산업안전보건기준에 관한 규칙 제302조(전기 기계·기구 등의 접지)'
  WHERE article_no IS NULL AND (description LIKE '%감전%' OR description LIKE '%누전%' OR description LIKE '%활선%' OR description LIKE '%차단기%' OR description LIKE '%절연%');

UPDATE public.hazard_library SET article_no='제232조', legal_basis='산업안전보건기준에 관한 규칙 제232조(폭발 또는 화재 등의 예방)'
  WHERE article_no IS NULL AND (description LIKE '%화재%' OR description LIKE '%폭발%' OR description LIKE '%가스%' OR description LIKE '%유류%');

UPDATE public.hazard_library SET article_no='제14조', legal_basis='산업안전보건기준에 관한 규칙 제14조(낙하물에 의한 위험의 방지)'
  WHERE article_no IS NULL AND description LIKE '%낙하%';

UPDATE public.hazard_library SET article_no='제13조', legal_basis='산업안전보건기준에 관한 규칙 제13조(안전난간의 구조 및 설치요건)'
  WHERE article_no IS NULL AND (description LIKE '%난간%' OR description LIKE '%개구부%');

UPDATE public.hazard_library SET article_no='제3조', legal_basis='산업안전보건기준에 관한 규칙 제3조(전도의 방지)'
  WHERE article_no IS NULL AND description LIKE '%전도%';
