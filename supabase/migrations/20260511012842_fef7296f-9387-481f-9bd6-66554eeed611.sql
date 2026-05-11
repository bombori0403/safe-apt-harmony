
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'member');
CREATE TYPE public.user_position AS ENUM ('관리사무소장','안전보건관리책임자','관리감독자','안전관리자','보건관리자','본사_안전담당','기타');
CREATE TYPE public.affiliation_type AS ENUM ('자가관리','위탁관리','본사');
CREATE TYPE public.mgmt_type AS ENUM ('자가관리','위탁관리');
CREATE TYPE public.assessment_type AS ENUM ('최초평가','정기평가','수시평가');
CREATE TYPE public.assessment_method AS ENUM ('3단계','5단계','빈도강도','체크리스트','OPS');
CREATE TYPE public.assessment_status AS ENUM ('작성중','협의중','완료');
CREATE TYPE public.risk_level AS ENUM ('매우낮음','낮음','보통','높음','매우높음');
CREATE TYPE public.measure_type AS ENUM ('본질적','공학적','관리적','개인보호구');
CREATE TYPE public.measure_status AS ENUM ('대기','진행중','완료');
CREATE TYPE public.work_category AS ENUM (
  '승강기 점검·정비','기계실·보일러실 작업','전기실·변전실 작업','옥상·외벽 작업',
  '어린이 놀이시설 점검','지하주차장·환기설비 작업','소방시설 점검','조경·외부 작업','청소·미화·일반 사무'
);

-- ============ TABLES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.complexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT,
  household_count INT,
  mgmt_type public.mgmt_type NOT NULL DEFAULT '자가관리',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  position public.user_position NOT NULL DEFAULT '기타',
  affiliation public.affiliation_type NOT NULL DEFAULT '자가관리',
  org_name TEXT,
  phone TEXT,
  primary_complex_id UUID REFERENCES public.complexes(id) ON DELETE SET NULL,
  primary_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  UNIQUE(user_id, role, company_id)
);

CREATE TABLE public.complex_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_complex TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(complex_id, user_id)
);

CREATE TABLE public.hazard_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.work_category NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assessment_type public.assessment_type NOT NULL DEFAULT '정기평가',
  work_name TEXT NOT NULL,
  work_category public.work_category,
  method public.assessment_method NOT NULL DEFAULT '5단계',
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  judgment_criteria JSONB DEFAULT '{}'::jsonb,
  allowable_level public.risk_level DEFAULT '낮음',
  status public.assessment_status NOT NULL DEFAULT '작성중',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  location_detail TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  exposed_workers JSONB DEFAULT '[]'::jsonb,
  likelihood INT,
  severity INT,
  level public.risk_level,
  level_standardized public.risk_level,
  checklist_result TEXT,
  ops_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id UUID NOT NULL REFERENCES public.hazards(id) ON DELETE CASCADE,
  measure_type public.measure_type NOT NULL DEFAULT '관리적',
  content TEXT NOT NULL,
  responsible_name TEXT,
  due_date DATE,
  status public.measure_status NOT NULL DEFAULT '대기',
  evidence JSONB DEFAULT '[]'::jsonb,
  residual_level public.risk_level,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  participation_role TEXT NOT NULL DEFAULT '근로자',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  signature_image TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  gps_lat NUMERIC,
  gps_lng NUMERIC
);

CREATE TABLE public.near_miss (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  occurred_at DATE,
  situation TEXT,
  cause TEXT,
  result TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.is_complex_member(_user_id UUID, _complex_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.complex_members WHERE user_id=_user_id AND complex_id=_complex_id) $$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='super_admin' AND (company_id=_company_id OR company_id IS NULL)) $$;

CREATE OR REPLACE FUNCTION public.can_access_complex(_user_id UUID, _complex_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_complex_member(_user_id, _complex_id)
  OR EXISTS (
    SELECT 1 FROM public.complexes c
    JOIN public.user_roles ur ON ur.company_id = c.company_id
    WHERE c.id = _complex_id AND ur.user_id = _user_id AND ur.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_assessment(_user_id UUID, _assessment_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_access_complex(_user_id, (SELECT complex_id FROM public.assessments WHERE id=_assessment_id));
$$;

-- ============ ENABLE RLS ============
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complex_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.near_miss ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- profiles: 본인만
CREATE POLICY "본인 프로필 조회" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()=id);
CREATE POLICY "본인 프로필 수정" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "본인 프로필 생성" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);

-- user_roles: 본인 조회만
CREATE POLICY "본인 역할 조회" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()=user_id);

-- companies: super_admin 또는 멤버 단지 소속
CREATE POLICY "회사 조회" ON public.companies FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.complexes c JOIN public.complex_members cm ON cm.complex_id=c.id WHERE c.company_id=companies.id AND cm.user_id=auth.uid())
);
CREATE POLICY "회사 생성" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "회사 수정" ON public.companies FOR UPDATE TO authenticated USING (public.is_company_admin(auth.uid(), id));

-- complexes
CREATE POLICY "단지 조회" ON public.complexes FOR SELECT TO authenticated USING (public.can_access_complex(auth.uid(), id));
CREATE POLICY "단지 생성" ON public.complexes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "단지 수정" ON public.complexes FOR UPDATE TO authenticated USING (public.can_access_complex(auth.uid(), id));
CREATE POLICY "단지 삭제" ON public.complexes FOR DELETE TO authenticated USING (public.is_company_admin(auth.uid(), company_id));

-- complex_members
CREATE POLICY "단지멤버 조회" ON public.complex_members FOR SELECT TO authenticated USING (public.can_access_complex(auth.uid(), complex_id));
CREATE POLICY "단지멤버 생성" ON public.complex_members FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id OR public.can_access_complex(auth.uid(), complex_id));
CREATE POLICY "단지멤버 삭제" ON public.complex_members FOR DELETE TO authenticated USING (public.can_access_complex(auth.uid(), complex_id));

-- hazard_library: 모두 조회
CREATE POLICY "라이브러리 조회" ON public.hazard_library FOR SELECT TO authenticated USING (true);

-- assessments
CREATE POLICY "평가 조회" ON public.assessments FOR SELECT TO authenticated USING (public.can_access_complex(auth.uid(), complex_id));
CREATE POLICY "평가 생성" ON public.assessments FOR INSERT TO authenticated WITH CHECK (public.can_access_complex(auth.uid(), complex_id));
CREATE POLICY "평가 수정" ON public.assessments FOR UPDATE TO authenticated USING (public.can_access_complex(auth.uid(), complex_id));
CREATE POLICY "평가 삭제" ON public.assessments FOR DELETE TO authenticated USING (public.can_access_complex(auth.uid(), complex_id));

-- hazards/measures/participants/signatures/near_miss: 평가 접근 권한 위임
CREATE POLICY "위험요인 전체" ON public.hazards FOR ALL TO authenticated USING (public.can_access_assessment(auth.uid(), assessment_id)) WITH CHECK (public.can_access_assessment(auth.uid(), assessment_id));
CREATE POLICY "감소대책 전체" ON public.measures FOR ALL TO authenticated USING (public.can_access_assessment(auth.uid(), (SELECT assessment_id FROM public.hazards WHERE id=hazard_id))) WITH CHECK (public.can_access_assessment(auth.uid(), (SELECT assessment_id FROM public.hazards WHERE id=hazard_id)));
CREATE POLICY "참여자 전체" ON public.participants FOR ALL TO authenticated USING (public.can_access_assessment(auth.uid(), assessment_id)) WITH CHECK (public.can_access_assessment(auth.uid(), assessment_id));
CREATE POLICY "서명 전체" ON public.signatures FOR ALL TO authenticated USING (public.can_access_assessment(auth.uid(), assessment_id)) WITH CHECK (public.can_access_assessment(auth.uid(), assessment_id));
CREATE POLICY "아차사고 전체" ON public.near_miss FOR ALL TO authenticated USING (public.can_access_assessment(auth.uid(), assessment_id)) WITH CHECK (public.can_access_assessment(auth.uid(), assessment_id));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_complex_id UUID;
  v_a1 UUID; v_a2 UUID; v_a3 UUID;
  v_h1 UUID; v_h2 UUID; v_h3 UUID;
BEGIN
  -- 프로필 생성
  INSERT INTO public.profiles (id, name, position, affiliation, org_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    COALESCE((NEW.raw_user_meta_data->>'position')::public.user_position, '기타'),
    COALESCE((NEW.raw_user_meta_data->>'affiliation')::public.affiliation_type, '자가관리'),
    NEW.raw_user_meta_data->>'org_name',
    NEW.raw_user_meta_data->>'phone'
  );
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');

  -- 샘플 단지 생성
  INSERT INTO public.complexes (name, address, household_count, mgmt_type)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'org_name','○○아파트'), '서울특별시 강남구', 1200, '위탁관리')
  RETURNING id INTO v_complex_id;

  UPDATE public.profiles SET primary_complex_id=v_complex_id WHERE id=NEW.id;
  INSERT INTO public.complex_members (complex_id, user_id, role_in_complex) VALUES (v_complex_id, NEW.id, '관리책임자');

  -- 샘플 평가 3건
  INSERT INTO public.assessments (complex_id, created_by, assessment_type, work_name, work_category, method, allowable_level, status)
  VALUES (v_complex_id, NEW.id, '정기평가', '승강기 정기점검', '승강기 점검·정비', '체크리스트', '낮음', '완료')
  RETURNING id INTO v_a1;
  
  INSERT INTO public.assessments (complex_id, created_by, assessment_type, work_name, work_category, method, allowable_level, status)
  VALUES (v_complex_id, NEW.id, '수시평가', '옥상 방수공사', '옥상·외벽 작업', 'OPS', '낮음', '협의중')
  RETURNING id INTO v_a2;

  INSERT INTO public.assessments (complex_id, created_by, assessment_type, work_name, work_category, method, allowable_level, status)
  VALUES (v_complex_id, NEW.id, '정기평가', '기계실 일상 점검', '기계실·보일러실 작업', '3단계', '낮음', '완료')
  RETURNING id INTO v_h1;

  -- 샘플 유해위험요인 (각 평가에 1개씩)
  INSERT INTO public.hazards (assessment_id, description, level, level_standardized) VALUES (v_a1, '점검구 개방 상태 방치', '보통', '보통');
  INSERT INTO public.hazards (assessment_id, description, level, level_standardized, ops_data) VALUES (v_a2, '안전대·안전모 미착용', '높음', '높음', '{"factors":["고소작업","보호구미착용","단독작업"]}'::jsonb);
  INSERT INTO public.hazards (assessment_id, description, level, level_standardized) VALUES (v_h1, '회전체 협착 위험', '낮음', '낮음');

  -- 샘플 참여자 4명
  INSERT INTO public.participants (assessment_id, name, role, participation_role) VALUES 
    (v_a1, '김관리', '관리사무소장', '책임자'),
    (v_a1, '이감독', '관리감독자', '평가자'),
    (v_a1, '박안전', '안전관리자', '검토자'),
    (v_a1, '최작업', '시설기사', '근로자');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- assessments updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER assessments_updated_at BEFORE UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ SEED 50 HAZARDS ============
INSERT INTO public.hazard_library (category, description, sort_order) VALUES
('승강기 점검·정비','기계실 진입 시 협착·추락',1),
('승강기 점검·정비','회로 점검 시 감전',2),
('승강기 점검·정비','비상정지 장치 미작동',3),
('승강기 점검·정비','와이어로프 노후 절단',4),
('승강기 점검·정비','점검구 개방 상태 방치',5),
('승강기 점검·정비','단독 작업 중 사고 발생',6),
('기계실·보일러실 작업','보일러 가스 누출·중독',1),
('기계실·보일러실 작업','고온 배관 화상',2),
('기계실·보일러실 작업','환기 불량 산소결핍',3),
('기계실·보일러실 작업','회전체 협착',4),
('기계실·보일러실 작업','유류 누출 화재',5),
('기계실·보일러실 작업','소음 노출 청력 손상',6),
('전기실·변전실 작업','고압 활선 감전',1),
('전기실·변전실 작업','차단기 오조작 아크',2),
('전기실·변전실 작업','절연저항 저하 누전',3),
('전기실·변전실 작업','변압기 절연유 누출',4),
('전기실·변전실 작업','안전장구 미착용',5),
('전기실·변전실 작업','작업 전 정전 미확인',6),
('옥상·외벽 작업','안전난간 미설치 추락',1),
('옥상·외벽 작업','안전대·안전모 미착용',2),
('옥상·외벽 작업','강풍·우천 시 작업 강행',3),
('옥상·외벽 작업','방수재 유증기 흡입',4),
('옥상·외벽 작업','자재 낙하 충돌',5),
('옥상·외벽 작업','단독 작업 중 추락',6),
('어린이 놀이시설 점검','노후 시설 파손에 의한 충돌',1),
('어린이 놀이시설 점검','모래·바닥재 위생 불량',2),
('어린이 놀이시설 점검','점검자 추락',3),
('어린이 놀이시설 점검','인증 시설 미점검',4),
('어린이 놀이시설 점검','보호자 부재 사각지대',5),
('지하주차장·환기설비 작업','차량 매연 일산화탄소 중독',1),
('지하주차장·환기설비 작업','환기설비 청소 중 추락',2),
('지하주차장·환기설비 작업','슬립·전도',3),
('지하주차장·환기설비 작업','화재·연기 확산',4),
('지하주차장·환기설비 작업','조명 불량 시야 차단',5),
('지하주차장·환기설비 작업','단독 작업자 고립',6),
('소방시설 점검','점검 중 오작동 분사',1),
('소방시설 점검','가스계 소화설비 질식',2),
('소방시설 점검','점검 중 추락',3),
('소방시설 점검','노후 배관 파손',4),
('소방시설 점검','점검자 안전교육 미이수',5),
('조경·외부 작업','예초기 비산물 충돌',1),
('조경·외부 작업','농약 살포 중독',2),
('조경·외부 작업','사다리·고소작업 추락',3),
('조경·외부 작업','동절기 빙판 전도',4),
('조경·외부 작업','곤충·해충 알레르기',5),
('청소·미화·일반 사무','약품 혼합 중독·화상',1),
('청소·미화·일반 사무','무거운 물건 운반 근골격계',2),
('청소·미화·일반 사무','미끄러운 바닥 전도',3),
('청소·미화·일반 사무','입주민 폭언·폭행',4),
('청소·미화·일반 사무','야간 단독 근무 위험',5);
