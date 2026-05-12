DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('관리사무소장','안전보건관리책임자','관리감독자','안전관리자','보건관리자','본사_안전담당','super_admin','기타');
CREATE TYPE mgmt_type AS ENUM ('자가관리','위탁관리');
CREATE TYPE assessment_type AS ENUM ('최초평가','정기평가','수시평가');
CREATE TYPE assessment_method AS ENUM ('3단계_판단법','5단계_판단법','빈도강도법','체크리스트법','OPS');
CREATE TYPE risk_level AS ENUM ('매우낮음','낮음','보통','높음','매우높음','상','중','하','적정','보완');
CREATE TYPE assessment_status AS ENUM ('작성중','협의중','완료');
CREATE TYPE measure_type AS ENUM ('본질적_대책','공학적_대책','관리적_대책','개인보호구');
CREATE TYPE measure_status AS ENUM ('대기','진행중','완료');
CREATE TYPE work_category AS ENUM ('승강기_점검정비','기계실_보일러실','전기실_변전실','옥상_외벽','어린이놀이시설','지하주차장_환기','소방시설','조경_외부작업','청소_미화_사무');
CREATE TYPE participation_role AS ENUM ('책임자','평가자','근로자','검토자');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT '기타',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_id ON users(auth_id);

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_number TEXT,
  super_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_companies_super_admin ON companies(super_admin_user_id);

CREATE TABLE complexes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  household_count INT,
  mgmt_type mgmt_type NOT NULL DEFAULT '위탁관리',
  manager_name TEXT,
  manager_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_complexes_company ON complexes(company_id);
CREATE INDEX idx_complexes_name ON complexes(name);

CREATE TABLE complex_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_complex user_role,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(complex_id, user_id)
);
CREATE INDEX idx_members_complex ON complex_members(complex_id);
CREATE INDEX idx_members_user ON complex_members(user_id);

CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assessment_type assessment_type NOT NULL,
  work_name TEXT NOT NULL,
  work_category work_category,
  method assessment_method NOT NULL,
  assessment_date DATE NOT NULL,
  location TEXT,
  judgment_criteria JSONB,
  allowable_level TEXT,
  status assessment_status DEFAULT '작성중',
  shared_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_assessments_complex ON assessments(complex_id);
CREATE INDEX idx_assessments_date ON assessments(assessment_date DESC);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_assessments_method ON assessments(method);

CREATE TABLE hazards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  location_detail TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  exposed_workers JSONB DEFAULT '[]'::jsonb,
  likelihood INT CHECK (likelihood >= 1 AND likelihood <= 5),
  severity INT CHECK (severity >= 1 AND severity <= 5),
  level risk_level,
  level_standardized risk_level,
  checklist_result TEXT CHECK (checklist_result IN ('적정','보완')),
  ops_data JSONB,
  library_item_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hazards_assessment ON hazards(assessment_id);
CREATE INDEX idx_hazards_level ON hazards(level);

CREATE TABLE measures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hazard_id UUID NOT NULL REFERENCES hazards(id) ON DELETE CASCADE,
  type measure_type NOT NULL,
  content TEXT NOT NULL,
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  responsible_name TEXT,
  due_date DATE,
  status measure_status DEFAULT '대기',
  evidence JSONB DEFAULT '[]'::jsonb,
  residual_level risk_level,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_measures_hazard ON measures(hazard_id);
CREATE INDEX idx_measures_status ON measures(status);
CREATE INDEX idx_measures_due ON measures(due_date);

CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  participation_role participation_role NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_participants_assessment ON participants(assessment_id);
CREATE INDEX idx_participants_user ON participants(user_id);

CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  signature_image TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_signatures_assessment ON signatures(assessment_id);
CREATE INDEX idx_signatures_participant ON signatures(participant_id);

CREATE TABLE near_miss (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  situation TEXT NOT NULL,
  cause TEXT,
  result TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_near_miss_complex ON near_miss(complex_id);
CREATE INDEX idx_near_miss_date ON near_miss(occurred_at DESC);

CREATE TABLE hazard_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category work_category NOT NULL,
  description TEXT NOT NULL,
  default_likelihood INT,
  default_severity INT,
  suggested_measures TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_library_category ON hazard_library(category);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_complexes_updated_at BEFORE UPDATE ON complexes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hazards_updated_at BEFORE UPDATE ON hazards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_measures_updated_at BEFORE UPDATE ON measures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION calculate_risk_level()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_score INT;
BEGIN
  IF NEW.likelihood IS NOT NULL AND NEW.severity IS NOT NULL THEN
    v_score := NEW.likelihood * NEW.severity;
    NEW.level := CASE
      WHEN v_score BETWEEN 1 AND 4 THEN '매우낮음'::risk_level
      WHEN v_score BETWEEN 5 AND 8 THEN '낮음'::risk_level
      WHEN v_score BETWEEN 9 AND 12 THEN '보통'::risk_level
      WHEN v_score BETWEEN 13 AND 16 THEN '높음'::risk_level
      WHEN v_score BETWEEN 17 AND 25 THEN '매우높음'::risk_level
    END;
    NEW.level_standardized := NEW.level;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_hazard_risk_level BEFORE INSERT OR UPDATE ON hazards FOR EACH ROW EXECUTE FUNCTION calculate_risk_level();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE complex_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_miss ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_self_select" ON users FOR SELECT USING (auth_id = auth.uid());
CREATE POLICY "users_self_update" ON users FOR UPDATE USING (auth_id = auth.uid());
CREATE POLICY "users_insert_self" ON users FOR INSERT WITH CHECK (auth_id = auth.uid());

CREATE POLICY "complexes_member_select" ON complexes FOR SELECT USING (
  complexes.id IN (SELECT cm.complex_id FROM complex_members cm JOIN users u ON u.id = cm.user_id WHERE u.auth_id = auth.uid())
  OR complexes.company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.super_admin_user_id WHERE u.auth_id = auth.uid())
);
CREATE POLICY "complexes_insert" ON complexes FOR INSERT WITH CHECK (true);
CREATE POLICY "complexes_update" ON complexes FOR UPDATE USING (
  complexes.id IN (SELECT cm.complex_id FROM complex_members cm JOIN users u ON u.id = cm.user_id WHERE u.auth_id = auth.uid())
);

CREATE POLICY "assessments_member_all" ON assessments FOR ALL USING (
  assessments.complex_id IN (SELECT cm.complex_id FROM complex_members cm JOIN users u ON u.id = cm.user_id WHERE u.auth_id = auth.uid())
  OR assessments.complex_id IN (SELECT cx.id FROM complexes cx JOIN companies c ON c.id = cx.company_id JOIN users u ON u.id = c.super_admin_user_id WHERE u.auth_id = auth.uid())
);

CREATE POLICY "hazards_via_assessment" ON hazards FOR ALL USING (hazards.assessment_id IN (SELECT a.id FROM assessments a));
CREATE POLICY "measures_via_hazard" ON measures FOR ALL USING (measures.hazard_id IN (SELECT h.id FROM hazards h));
CREATE POLICY "participants_via_assessment" ON participants FOR ALL USING (participants.assessment_id IN (SELECT a.id FROM assessments a));
CREATE POLICY "signatures_via_assessment" ON signatures FOR ALL USING (signatures.assessment_id IN (SELECT a.id FROM assessments a));
CREATE POLICY "near_miss_via_complex" ON near_miss FOR ALL USING (near_miss.complex_id IN (SELECT cx.id FROM complexes cx));
CREATE POLICY "members_via_complex" ON complex_members FOR ALL USING (
  complex_members.complex_id IN (SELECT cx.id FROM complexes cx)
  OR complex_members.user_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "companies_admin_select" ON companies FOR SELECT USING (
  companies.super_admin_user_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "library_public_read" ON hazard_library FOR SELECT USING (TRUE);

INSERT INTO hazard_library (category, description, default_likelihood, default_severity, sort_order) VALUES
('승강기_점검정비','기계실 진입 시 협착·추락',3,4,1),
('승강기_점검정비','회로 점검 시 감전',2,5,2),
('승강기_점검정비','비상정지 장치 미작동',2,5,3),
('승강기_점검정비','와이어로프 노후 절단',1,5,4),
('승강기_점검정비','점검구 개방 상태 방치',3,4,5),
('승강기_점검정비','단독 작업 중 사고 발생',3,4,6),
('기계실_보일러실','보일러 가스 누출·중독',2,5,1),
('기계실_보일러실','고온 배관 화상',3,3,2),
('기계실_보일러실','환기 불량 산소결핍',2,5,3),
('기계실_보일러실','회전체 협착',2,4,4),
('기계실_보일러실','유류 누출 화재',2,5,5),
('기계실_보일러실','소음 노출 청력 손상',4,2,6),
('전기실_변전실','고압 활선 감전',1,5,1),
('전기실_변전실','차단기 오조작 아크',2,5,2),
('전기실_변전실','절연저항 저하 누전',2,4,3),
('전기실_변전실','변압기 절연유 누출',1,3,4),
('전기실_변전실','안전장구 미착용',3,5,5),
('전기실_변전실','작업 전 정전 미확인',2,5,6),
('옥상_외벽','안전난간 미설치 추락',3,5,1),
('옥상_외벽','안전대·안전모 미착용',4,5,2),
('옥상_외벽','강풍·우천 시 작업 강행',3,5,3),
('옥상_외벽','방수재 유증기 흡입',3,3,4),
('옥상_외벽','자재 낙하 충돌',3,4,5),
('옥상_외벽','단독 작업 중 추락',2,5,6),
('어린이놀이시설','노후 시설 파손에 의한 충돌',3,3,1),
('어린이놀이시설','모래·바닥재 위생 불량',4,2,2),
('어린이놀이시설','점검자 추락',2,3,3),
('어린이놀이시설','인증 시설 미점검',3,4,4),
('어린이놀이시설','보호자 부재 사각지대',3,3,5),
('지하주차장_환기','차량 매연 일산화탄소 중독',3,4,1),
('지하주차장_환기','환기설비 청소 중 추락',3,4,2),
('지하주차장_환기','슬립·전도',4,2,3),
('지하주차장_환기','화재·연기 확산',2,5,4),
('지하주차장_환기','조명 불량 시야 차단',3,3,5),
('지하주차장_환기','단독 작업자 고립',2,4,6),
('소방시설','점검 중 오작동 분사',2,3,1),
('소방시설','가스계 소화설비 질식',1,5,2),
('소방시설','점검 중 추락',2,4,3),
('소방시설','노후 배관 파손',2,3,4),
('소방시설','점검자 안전교육 미이수',3,3,5),
('조경_외부작업','예초기 비산물 충돌',4,3,1),
('조경_외부작업','농약 살포 중독',3,4,2),
('조경_외부작업','사다리·고소작업 추락',3,4,3),
('조경_외부작업','동절기 빙판 전도',4,3,4),
('조경_외부작업','곤충·해충 알레르기',3,2,5),
('청소_미화_사무','약품 혼합 중독·화상',2,4,1),
('청소_미화_사무','무거운 물건 운반 근골격계',4,2,2),
('청소_미화_사무','미끄러운 바닥 전도',4,2,3),
('청소_미화_사무','입주민 폭언·폭행',3,3,4),
('청소_미화_사무','야간 단독 근무 위험',3,3,5);

CREATE OR REPLACE FUNCTION create_sample_data_for_user(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_complex_id UUID; v_assessment_id UUID;
BEGIN
  INSERT INTO complexes (name, address, household_count, mgmt_type, manager_name)
  VALUES ('○○아파트 (샘플)','서울특별시 강남구',1200,'위탁관리','홍길동')
  RETURNING id INTO v_complex_id;

  INSERT INTO complex_members (complex_id, user_id, role_in_complex)
  VALUES (v_complex_id, p_user_id, '관리사무소장');

  INSERT INTO assessments (complex_id, created_by, assessment_type, work_name, work_category, method, assessment_date, status, allowable_level)
  VALUES (v_complex_id, p_user_id, '정기평가', '승강기 정기점검','승강기_점검정비','체크리스트법', CURRENT_DATE - INTERVAL '7 days','완료','적정')
  RETURNING id INTO v_assessment_id;
  INSERT INTO hazards (assessment_id, description, checklist_result, level, level_standardized) VALUES
    (v_assessment_id,'기계실 진입 시 협착·추락','적정','낮음','낮음'),
    (v_assessment_id,'비상정지 장치 작동 확인','보완','보통','보통');

  INSERT INTO assessments (complex_id, created_by, assessment_type, work_name, work_category, method, assessment_date, status, allowable_level)
  VALUES (v_complex_id, p_user_id, '수시평가','옥상 방수공사 (외주)','옥상_외벽','OPS', CURRENT_DATE - INTERVAL '3 days','협의중','낮음')
  RETURNING id INTO v_assessment_id;
  INSERT INTO hazards (assessment_id, description, level, level_standardized, ops_data) VALUES
    (v_assessment_id,'고소작업 중 추락','높음','높음','{"scenario":"안전대 미착용 시 추락 사망","core_measures":["안전대 100% 착용 확인","안전난간 임시 설치","2인 1조 작업"]}'::jsonb);

  INSERT INTO assessments (complex_id, created_by, assessment_type, work_name, work_category, method, assessment_date, status, allowable_level)
  VALUES (v_complex_id, p_user_id, '정기평가','기계실 일상 점검','기계실_보일러실','3단계_판단법', CURRENT_DATE - INTERVAL '1 day','완료','하')
  RETURNING id INTO v_assessment_id;
  INSERT INTO hazards (assessment_id, description, level, level_standardized) VALUES
    (v_assessment_id,'보일러 가스 누출 점검','하','낮음'),
    (v_assessment_id,'고온 배관 화상 위험','중','보통');

  RETURN v_complex_id;
END; $$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID;
BEGIN
  INSERT INTO public.users (auth_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  RETURNING id INTO v_user_id;
  PERFORM create_sample_data_for_user(v_user_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE VIEW v_company_dashboard AS
SELECT c.id AS company_id, c.name AS company_name, cx.id AS complex_id, cx.name AS complex_name, cx.address,
  COUNT(a.id) FILTER (WHERE a.created_at >= DATE_TRUNC('month', NOW())) AS this_month_count,
  COUNT(h.id) FILTER (WHERE h.level_standardized IN ('높음','매우높음') AND m.status != '완료') AS unresolved_high,
  MAX(a.assessment_date) AS last_assessment_date,
  AVG(CASE WHEN p.confirmed THEN 1.0 ELSE 0.0 END) * 100 AS avg_participation_rate
FROM companies c
LEFT JOIN complexes cx ON cx.company_id = c.id
LEFT JOIN assessments a ON a.complex_id = cx.id
LEFT JOIN hazards h ON h.assessment_id = a.id
LEFT JOIN measures m ON m.hazard_id = h.id
LEFT JOIN participants p ON p.assessment_id = a.id
GROUP BY c.id, c.name, cx.id, cx.name, cx.address;