
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('super_admin','school_admin','head_teacher','deputy_head_teacher','dos','class_teacher','subject_teacher');
CREATE TYPE public.school_status AS ENUM ('active','suspended');
CREATE TYPE public.student_status AS ENUM ('pending','active','inactive');
CREATE TYPE public.assessment_status AS ENUM ('draft','submitted','approved','rejected');

-- ===== SCHOOLS =====
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  email text,
  phone text,
  motto text,
  logo_url text,
  status public.school_status NOT NULL DEFAULT 'active',
  subscription_plan text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  initials text,
  phone text,
  must_change_password boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ===== ROLES =====
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- ===== HELPERS =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_manage_school()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','school_admin','head_teacher','deputy_head_teacher')
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_super boolean;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO has_super;
  IF NOT has_super THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== ACADEMIC STRUCTURE =====
CREATE TABLE public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  level int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade text NOT NULL,
  min_score numeric NOT NULL,
  max_score numeric NOT NULL,
  descriptor text NOT NULL,
  identifier numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_number text,
  lin text,
  full_name text NOT NULL,
  gender text,
  date_of_birth date,
  photo_url text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  house text,
  schpay_code text,
  fees_balance numeric NOT NULL DEFAULT 0,
  address text,
  parent_name text,
  parent_phone text,
  guardian_name text,
  guardian_phone text,
  status public.student_status NOT NULL DEFAULT 'pending',
  created_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teacher_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id uuid REFERENCES public.streams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  formative numeric,
  summative numeric,
  teacher_initials text,
  status public.assessment_status NOT NULL DEFAULT 'draft',
  locked boolean NOT NULL DEFAULT false,
  rejection_reason text,
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, term_id)
);

CREATE TABLE public.attendance_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  days_present int NOT NULL DEFAULT 0,
  days_absent int NOT NULL DEFAULT 0,
  UNIQUE (student_id, term_id)
);

CREATE TABLE public.report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  class_teacher_comment text,
  head_teacher_comment text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term_id)
);

CREATE TABLE public.co_curricular (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  games text,
  clubs text,
  projects text,
  UNIQUE (student_id, term_id)
);

CREATE TABLE public.feature_toggles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (school_id, module)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity text,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- indexes
CREATE INDEX idx_students_school ON public.students(school_id);
CREATE INDEX idx_students_class ON public.students(class_id);
CREATE INDEX idx_assessments_school ON public.assessments(school_id);
CREATE INDEX idx_assessments_student_term ON public.assessments(student_id, term_id);
CREATE INDEX idx_audit_school ON public.audit_logs(school_id, created_at DESC);

-- grants + RLS for the tenant tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['academic_years','terms','classes','streams','subjects','grading_scales','students','teacher_allocations','assessments','attendance_summaries','report_comments','co_curricular','feature_toggles','notifications','audit_logs']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY "tenant_read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());$p$, t);
    EXECUTE format($p$CREATE POLICY "tenant_write_%1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());$p$, t);
    EXECUTE format($p$CREATE POLICY "tenant_update_%1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id()) WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());$p$, t);
    EXECUTE format($p$CREATE POLICY "tenant_delete_%1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));$p$, t);
  END LOOP;
END $$;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_read" ON public.schools FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_school_id());
CREATE POLICY "schools_insert" ON public.schools FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "schools_update" ON public.schools FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (id = public.current_school_id() AND public.can_manage_school()))
  WITH CHECK (public.is_super_admin() OR (id = public.current_school_id() AND public.can_manage_school()));
CREATE POLICY "schools_delete" ON public.schools FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()))
  WITH CHECK (id = auth.uid() OR public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin() OR school_id = public.current_school_id());

-- ===== SEED DEMO SCHOOL =====
INSERT INTO public.schools (id, name, code, address, email, phone, motto, status)
VALUES ('11111111-1111-1111-1111-111111111111','KIGANDO SEED SEC. SCHOOL','KSS','P.O. Box 31, Mubende','betethkats@gmail.com','+256 7772557529 / +256704743872','Education for Service','active');

INSERT INTO public.academic_years (id, school_id, name, is_current)
VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','2026', true);

INSERT INTO public.terms (id, school_id, academic_year_id, name, is_current)
VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','TERM I', true);

INSERT INTO public.classes (id, school_id, name, level)
VALUES ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','S2',2);

INSERT INTO public.streams (id, school_id, class_id, name)
VALUES ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','NORTH');

INSERT INTO public.grading_scales (school_id, grade, min_score, max_score, descriptor, identifier) VALUES
('11111111-1111-1111-1111-111111111111','A+',90,100,'Outstanding performance.',3),
('11111111-1111-1111-1111-111111111111','A',80,89.99,'Achieved MOST or ALL competencies exceedingly well.',3),
('11111111-1111-1111-1111-111111111111','B',70,79.99,'Very Good performance.',2),
('11111111-1111-1111-1111-111111111111','C',60,69.99,'Achieved a good number of competencies.',2),
('11111111-1111-1111-1111-111111111111','D',45,59.99,'Achieved basic competencies in the subject.',1),
('11111111-1111-1111-1111-111111111111','E',0,44.99,'Below basic competency.',1);

INSERT INTO public.subjects (id, school_id, name, code, position) VALUES
('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','MATHEMATICS','MTC',1),
('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','ENGLISH','ENG',2),
('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','HISTORY','HIS',3),
('a0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','GEOGRAPHY','GEO',4),
('a0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','CHRISTIAN REL. EDUC.','CRE',5),
('a0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','LITERATURE IN ENG.','LIT',6),
('a0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','ICT','ICT',7),
('a0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','AGRICULTURE','AGR',8),
('a0000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','ART & DESIGN','ART',9),
('a0000000-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','LUGANDA','LUG',10);

INSERT INTO public.students (id, school_id, student_number, lin, full_name, gender, class_id, stream_id, house, fees_balance, status, parent_name, parent_phone)
VALUES
('b0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','KSS051','KSS051','IMMACULATE NAKITENDE','Female','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555','RED',0,'active','John Nakitende','+256700000001'),
('b0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','KSS052','KSS052','BRIAN MUGISHA','Male','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555','BLUE',25000,'active','Peter Mugisha','+256700000002'),
('b0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','KSS053','KSS053','SARAH ACHEN','Female','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555','GREEN',0,'pending','Alice Achen','+256700000003');

INSERT INTO public.assessments (school_id, student_id, subject_id, term_id, formative, summative, teacher_initials, status, locked, approved_at) VALUES
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',10,40,'AE','approved',true,now()),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333',16,64,'NF','approved',true,now()),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333',13.3,53,'BS','approved',true,now()),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333333',18,74,'IB','approved',true,now()),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005','33333333-3333-3333-3333-333333333333',16,40,'ND','approved',true,now()),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333333',14.7,61,'TN','approved',true,now()),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',14,55,'AE','approved',true,now()),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333',12,50,'NF','submitted',false,null);

INSERT INTO public.attendance_summaries (school_id, student_id, term_id, days_present, days_absent) VALUES
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',89,0),
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333',85,4);

INSERT INTO public.report_comments (school_id, student_id, term_id, class_teacher_comment, head_teacher_comment) VALUES
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','Thanks for studying but you have to improve on weak subjects.','You are a good student. Try to put more effort into poorly done subjects.');

INSERT INTO public.co_curricular (school_id, student_id, term_id, games, clubs, projects) VALUES
('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','Netball','Debate Club','School Garden Project');

INSERT INTO public.feature_toggles (school_id, module, enabled) VALUES
('11111111-1111-1111-1111-111111111111','fees',true),
('11111111-1111-1111-1111-111111111111','attendance',true),
('11111111-1111-1111-1111-111111111111','library',false),
('11111111-1111-1111-1111-111111111111','transport',false),
('11111111-1111-1111-1111-111111111111','hostel',false),
('11111111-1111-1111-1111-111111111111','inventory',false),
('11111111-1111-1111-1111-111111111111','sms',false),
('11111111-1111-1111-1111-111111111111','parent_portal',false),
('11111111-1111-1111-1111-111111111111','discipline',true),
('11111111-1111-1111-1111-111111111111','report_cards',true),
('11111111-1111-1111-1111-111111111111','co_curricular',true);
