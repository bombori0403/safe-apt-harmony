-- Extend legal-basis coverage by analogy: apply an already-confirmed
-- article to hazards that share the same underlying risk theme (fall,
-- falling object, fire/heat, electrical, PPE, etc.), per user direction.
-- Genuinely dissimilar hazards (lone-work, ergonomics, supervision,
-- workplace violence, training compliance) are intentionally left blank —
-- none of the confirmed articles fit those themes.

-- 추락(fall) theme → 제13조(안전난간의 구조 및 설치요건)
UPDATE public.hazard_library SET article_no='제13조', legal_basis='산업안전보건기준에 관한 규칙 제13조(안전난간의 구조 및 설치요건)'
  WHERE article_no IS NULL AND (
    description LIKE '%추락%' OR description LIKE '%강풍%' OR description LIKE '%개방 상태%'
  );

-- 낙하·비산물(falling/flying object) theme → 제14조(낙하물에 의한 위험의 방지)
UPDATE public.hazard_library SET article_no='제14조', legal_basis='산업안전보건기준에 관한 규칙 제14조(낙하물에 의한 위험의 방지)'
  WHERE article_no IS NULL AND (
    description LIKE '%와이어로프%' OR description LIKE '%파손에 의한 충돌%' OR description LIKE '%비산물%'
  );

-- 화재·고열(fire/heat) theme → 제232조(폭발 또는 화재 등의 예방)
UPDATE public.hazard_library SET article_no='제232조', legal_basis='산업안전보건기준에 관한 규칙 제232조(폭발 또는 화재 등의 예방)'
  WHERE article_no IS NULL AND (
    description LIKE '%화상%' OR description LIKE '%배관 파손%'
  );

-- 전기(electrical) theme → 제302조(전기 기계·기구의 접지)
UPDATE public.hazard_library SET article_no='제302조', legal_basis='산업안전보건기준에 관한 규칙 제302조(전기 기계·기구의 접지)'
  WHERE article_no IS NULL AND (
    description LIKE '%정전 미확인%' OR description LIKE '%비상정지 장치%'
  );

-- 보호구(PPE) theme → 제34조(전용보호구 등)
UPDATE public.hazard_library SET article_no='제34조', legal_basis='산업안전보건기준에 관한 규칙 제34조(전용보호구 등)'
  WHERE article_no IS NULL AND (
    description LIKE '%유증기 흡입%' OR description LIKE '%알레르기%' OR description LIKE '%청력 손상%'
  );
