-- Formative marks are whole-term results and must not be tied to BOT, MOT, or EOT.
CREATE TABLE IF NOT EXISTS public.formative_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  mark numeric NOT NULL CHECK (mark BETWEEN 0 AND 20),
  teacher_initials text NOT NULL,
  status public.assessment_status NOT NULL DEFAULT 'draft',
  locked boolean NOT NULL DEFAULT false,
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, term_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formative_marks TO authenticated;
GRANT ALL ON public.formative_marks TO service_role;

ALTER TABLE public.formative_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formative_marks_read ON public.formative_marks;
DROP POLICY IF EXISTS formative_marks_insert ON public.formative_marks;
DROP POLICY IF EXISTS formative_marks_update ON public.formative_marks;
DROP POLICY IF EXISTS formative_marks_delete ON public.formative_marks;

CREATE POLICY formative_marks_read ON public.formative_marks
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY formative_marks_insert ON public.formative_marks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY formative_marks_update ON public.formative_marks
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id())
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY formative_marks_delete ON public.formative_marks
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

CREATE INDEX IF NOT EXISTS formative_marks_lookup_idx
  ON public.formative_marks (school_id, student_id, subject_id, term_id);
