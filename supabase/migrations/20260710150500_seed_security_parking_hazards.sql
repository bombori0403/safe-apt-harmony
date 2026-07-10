-- Step 2: preset hazards for the two new categories, seeded from the real
-- KRAS document the user provided. Legal basis only where confidently
-- confirmed in that document; the rest are left blank rather than guessed.

INSERT INTO public.hazard_library (category, description, default_likelihood, default_severity, sort_order, article_no, legal_basis) VALUES
  ('경비_보안', '계단 폭이 좁아 오르내림 중 사고 위험', 2, 2, 1, '제22조', '산업안전보건기준에 관한 규칙 제22조(계단의 강도)'),
  ('경비_보안', '통로 장애물 정리 안 됨으로 인한 전도 위험', 2, 2, 2, '제3조', '산업안전보건기준에 관한 규칙 제3조(전도의 방지)'),
  ('경비_보안', '야간 순찰 중 조명 불량으로 시야 확보 곤란', 2, 2, 3, '제21조', '산업안전보건기준에 관한 규칙 제21조(통로의 설치)'),
  ('경비_보안', '차량 출입 통제 중 교통사고 위험', 2, 3, 4, NULL, NULL),
  ('경비_보안', '장시간 서 있는 자세로 인한 근골격계 부담', 2, 2, 5, NULL, NULL),
  ('주차관리', '전기차 충전 중 배터리 화재 위험', 2, 4, 1, '제232조', '산업안전보건기준에 관한 규칙 제232조(폭발 또는 화재 등의 예방)'),
  ('주차관리', '지하주차장 대피통로 확보 미흡', 2, 3, 2, '제21조', '산업안전보건기준에 관한 규칙 제21조(통로의 설치)'),
  ('주차관리', '출입구에서 차량·보행자 혼재로 인한 안전사고', 2, 3, 3, NULL, NULL),
  ('주차관리', '장시간 서서 근무로 인한 근골격계 질환', 2, 2, 4, NULL, NULL);
