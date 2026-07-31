-- ============ helper functions ============
CREATE OR REPLACE FUNCTION public.can_manage_academics()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('school_admin','head_teacher','deputy_head_teacher','dos'));
$$;

CREATE OR REPLACE FUNCTION public.can_view_all_students()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('school_admin','head_teacher','deputy_head_teacher','dos','class_teacher'));
$$;

CREATE OR REPLACE FUNCTION public.teacher_scope_matches(_class_id uuid, _stream_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_allocations ta
    WHERE ta.teacher_id = auth.uid()
      AND (ta.class_id IS NULL OR ta.class_id = _class_id)
      AND (ta.stream_id IS NULL OR ta.stream_id = _stream_id)
  );
$$;

-- ============ column additions ============
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS report_header text,
  ADD COLUMN IF NOT EXISTS signatories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stamp_url text,
  ADD COLUMN IF NOT EXISTS formative_weight numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS summative_weight numeric NOT NULL DEFAULT 80;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'core';

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS approver_name text,
  ADD COLUMN IF NOT EXISTS approver_role text,
  ADD COLUMN IF NOT EXISTS exam_type text NOT NULL DEFAULT 'end_of_term';

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS user_agent text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS teacher_number text,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS students_school_number_uniq
  ON public.students (school_id, lower(student_number))
  WHERE student_number IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_lin_uniq
  ON public.students (school_id, lower(lin))
  WHERE lin IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS students_class_stream_idx ON public.students (school_id, class_id, stream_id);
CREATE INDEX IF NOT EXISTS assessments_lookup_idx ON public.assessments (school_id, term_id, subject_id);

-- ============ new tables ============
CREATE TABLE IF NOT EXISTS public.student_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  phone text,
  email text,
  occupation text,
  address text,
  is_emergency boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id uuid REFERENCES public.streams(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  period integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  classroom text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS timetable_slot_uniq ON public.timetable_entries
  (school_id, term_id, class_id, COALESCE(stream_id, '00000000-0000-0000-0000-000000000000'::uuid), day_of_week, period);
CREATE UNIQUE INDEX IF NOT EXISTS timetable_teacher_uniq ON public.timetable_entries
  (school_id, term_id, teacher_id, day_of_week, period);

CREATE TABLE IF NOT EXISTS public.teacher_allocation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  subject_id uuid,
  class_id uuid,
  stream_id uuid,
  action text NOT NULL,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid,
  from_class_id uuid,
  from_stream_id uuid,
  to_class_id uuid,
  to_stream_id uuid,
  outcome text NOT NULL,
  notes text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_edit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  granted_by uuid,
  granted_by_name text,
  reason text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.school_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid,
  term_id uuid,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'event',
  start_date date NOT NULL,
  end_date date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  school_id uuid,
  email text,
  success boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ============ grants, RLS and tenant policies for new tables ============
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'student_guardians','student_subjects','timetable_entries','teacher_allocation_history',
    'student_promotions','student_history','assessment_edit_grants','attendance_records',
    'teacher_attendance','school_events'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_read_%1$s ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_write_%1$s ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update_%1$s ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE POLICY tenant_read_%1$s ON public.%1$I FOR SELECT TO authenticated USING (school_id = public.current_school_id())', t);
    EXECUTE format('CREATE POLICY tenant_write_%1$s ON public.%1$I FOR INSERT TO authenticated WITH CHECK (school_id = public.current_school_id())', t);
    EXECUTE format('CREATE POLICY tenant_update_%1$s ON public.%1$I FOR UPDATE TO authenticated USING (school_id = public.current_school_id()) WITH CHECK (school_id = public.current_school_id())', t);
    EXECUTE format('CREATE POLICY tenant_delete_%1$s ON public.%1$I FOR DELETE TO authenticated USING (school_id = public.current_school_id() AND public.can_manage_academics())', t);
  END LOOP;
END
$do$;

GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS login_events_insert ON public.login_events;
DROP POLICY IF EXISTS login_events_read ON public.login_events;
CREATE POLICY login_events_insert ON public.login_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY login_events_read ON public.login_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

-- ============ revoke platform-owner access to school academic data ============
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academic_years','assessments','attendance_summaries','classes','co_curricular',
    'grading_scales','report_comments','streams','students','subjects','teacher_allocations','terms','audit_logs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_read_%1$s ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_write_%1$s ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update_%1$s ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE POLICY tenant_read_%1$s ON public.%1$I FOR SELECT TO authenticated USING (school_id = public.current_school_id())', t);
    EXECUTE format('CREATE POLICY tenant_write_%1$s ON public.%1$I FOR INSERT TO authenticated WITH CHECK (school_id = public.current_school_id())', t);
    EXECUTE format('CREATE POLICY tenant_update_%1$s ON public.%1$I FOR UPDATE TO authenticated USING (school_id = public.current_school_id()) WITH CHECK (school_id = public.current_school_id())', t);
    EXECUTE format('CREATE POLICY tenant_delete_%1$s ON public.%1$I FOR DELETE TO authenticated USING (school_id = public.current_school_id() AND public.can_manage_academics())', t);
  END LOOP;
END
$do$;

-- teachers only see learners in their allocated classes/streams
DROP POLICY IF EXISTS tenant_read_students ON public.students;
CREATE POLICY tenant_read_students ON public.students FOR SELECT TO authenticated
  USING (school_id = public.current_school_id()
    AND (public.can_view_all_students() OR public.teacher_scope_matches(class_id, stream_id)));

-- ============ platform analytics for the platform owner ============
CREATE OR REPLACE FUNCTION public.platform_school_stats()
RETURNS TABLE (
  school_id uuid, school_name text, code text, status public.school_status,
  subscription_plan text, user_count bigint, student_count bigint,
  logins_30d bigint, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.code, s.status, s.subscription_plan,
    (SELECT count(*) FROM public.profiles p WHERE p.school_id = s.id),
    (SELECT count(*) FROM public.students st WHERE st.school_id = s.id AND st.deleted_at IS NULL),
    (SELECT count(*) FROM public.login_events le WHERE le.school_id = s.id AND le.occurred_at > now() - interval '30 days'),
    s.created_at
  FROM public.schools s
  WHERE public.is_super_admin();
$$;
GRANT EXECUTE ON FUNCTION public.platform_school_stats() TO authenticated;

-- timetable conflict validation (defence in depth beyond the unique indexes)
CREATE OR REPLACE FUNCTION public.validate_timetable_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.timetable_entries e
    WHERE e.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND e.term_id = NEW.term_id
      AND e.day_of_week = NEW.day_of_week
      AND e.teacher_id = NEW.teacher_id
      AND NEW.start_time < e.end_time AND e.start_time < NEW.end_time
  ) THEN
    RAISE EXCEPTION 'This teacher is already scheduled during that time slot';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.timetable_entries e
    WHERE e.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND e.term_id = NEW.term_id
      AND e.day_of_week = NEW.day_of_week
      AND e.class_id = NEW.class_id
      AND COALESCE(e.stream_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(NEW.stream_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.start_time < e.end_time AND e.start_time < NEW.end_time
  ) THEN
    RAISE EXCEPTION 'This class/stream already has a lesson during that time slot';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_timetable_entry_trg ON public.timetable_entries;
CREATE TRIGGER validate_timetable_entry_trg BEFORE INSERT OR UPDATE ON public.timetable_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_timetable_entry();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS student_guardians_touch ON public.student_guardians;
CREATE TRIGGER student_guardians_touch BEFORE UPDATE ON public.student_guardians
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();