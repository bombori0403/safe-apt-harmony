-- Additional legal-basis seeds, verified against a second real KRAS export
-- the user provided (covers 시설관리/미화/경비 categories). Only mapping
-- rows with a clear keyword match to what's confirmed in that document —
-- leaving genuinely uncertain ones blank rather than guessing.

UPDATE public.hazard_library SET article_no='제4조', legal_basis='산업안전보건기준에 관한 규칙 제4조(작업장의 청결)'
  WHERE article_no IS NULL AND description LIKE '%위생 불량%';

UPDATE public.hazard_library SET article_no='제21조', legal_basis='산업안전보건기준에 관한 규칙 제21조(통로의 설치)'
  WHERE article_no IS NULL AND description LIKE '%조명 불량%';

UPDATE public.hazard_library SET article_no='제79조', legal_basis='산업안전보건기준에 관한 규칙 제79조(신체 등의 안전 보호)'
  WHERE article_no IS NULL AND (description LIKE '%매연%' OR description LIKE '%중독%일산화탄소%' OR description LIKE '%산소결핍%');

UPDATE public.hazard_library SET article_no='제395조', legal_basis='산업안전보건기준에 관한 규칙 제395조(누출ㆍ유출 등에 대비한 조치)'
  WHERE article_no IS NULL AND (description LIKE '%약품%' OR description LIKE '%농약%');
