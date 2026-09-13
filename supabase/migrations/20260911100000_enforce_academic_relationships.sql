-- Keep learner placement and assessment ownership consistent when records are
-- created or edited directly through Supabase, not only through the UI.

-- These constraints are NOT VALID so existing legacy rows can be reviewed and
-- corrected without preventing the migration. They still reject every new
-- row and every later update that would introduce a missing value.
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.streams
  DROP CONSTRAINT IF EXISTS streams_teacher_required;
ALTER TABLE public.streams
  ADD CONSTRAINT streams_teacher_required
  CHECK (stream_teacher_id IS NOT NULL) NOT VALID;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_class_required;
ALTER TABLE public.students
  ADD CONSTRAINT students_class_required
  CHECK (class_id IS NOT NULL) NOT VALID;

ALTER TABLE public.teacher_allocations
  DROP CONSTRAINT IF EXISTS teacher_allocations_class_required;
ALTER TABLE public.teacher_allocations
  ADD CONSTRAINT teacher_allocations_class_required
  CHECK (class_id IS NOT NULL) NOT VALID;

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_required_values;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_required_values
  CHECK (
    student_id IS NOT NULL
    AND subject_id IS NOT NULL
    AND term_id IS NOT NULL
    AND formative IS NOT NULL
    AND summative IS NOT NULL
    AND formative BETWEEN 0 AND 20
    AND summative BETWEEN 0 AND 80
    AND teacher_initials IS NOT NULL
    AND btrim(teacher_initials) <> ''
    AND submitted_by IS NOT NULL
    AND exam_type IS NOT NULL
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.validate_class_stream_relation(
  p_school_id uuid,
  p_class_id uuid,
  p_stream_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_class_school_id uuid;
  v_stream_school_id uuid;
  v_stream_class_id uuid;
BEGIN
  IF p_class_id IS NULL THEN
    RAISE EXCEPTION 'A class is required before saving this academic record';
  END IF;

  SELECT school_id INTO v_class_school_id
  FROM public.classes
  WHERE id = p_class_id;

  IF v_class_school_id IS NULL OR v_class_school_id <> p_school_id THEN
    RAISE EXCEPTION 'The selected class does not belong to this school';
  END IF;

  IF p_stream_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.streams
      WHERE school_id = p_school_id AND class_id = p_class_id
    ) THEN
      RAISE EXCEPTION 'A stream is required for the selected class';
    END IF;
    RETURN;
  END IF;

  SELECT school_id, class_id
  INTO v_stream_school_id, v_stream_class_id
  FROM public.streams
  WHERE id = p_stream_id;

  IF v_stream_school_id IS NULL OR v_stream_school_id <> p_school_id THEN
    RAISE EXCEPTION 'The selected stream does not belong to this school';
  END IF;
  IF v_stream_class_id <> p_class_id THEN
    RAISE EXCEPTION 'The selected stream must belong to the selected class';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_academic_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_class_school_id uuid;
  v_student_school_id uuid;
  v_student_class_id uuid;
  v_student_stream_id uuid;
  v_subject_school_id uuid;
  v_term_school_id uuid;
  v_teacher_school_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'streams' THEN
    SELECT school_id INTO v_class_school_id
    FROM public.classes
    WHERE id = NEW.class_id;
    IF v_class_school_id IS NULL OR v_class_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'The selected class does not belong to this school';
    END IF;
    SELECT school_id INTO v_teacher_school_id
    FROM public.profiles
    WHERE id = NEW.stream_teacher_id;
    IF v_teacher_school_id IS NULL OR v_teacher_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'A stream teacher from this school is required';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'students' THEN
    PERFORM public.validate_class_stream_relation(NEW.school_id, NEW.class_id, NEW.stream_id);
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'teacher_allocations' THEN
    PERFORM public.validate_class_stream_relation(NEW.school_id, NEW.class_id, NEW.stream_id);

    SELECT school_id INTO v_teacher_school_id
    FROM public.profiles
    WHERE id = NEW.teacher_id;
    IF v_teacher_school_id IS NULL OR v_teacher_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'The selected teacher does not belong to this school';
    END IF;

    SELECT school_id INTO v_subject_school_id
    FROM public.subjects
    WHERE id = NEW.subject_id;
    IF v_subject_school_id IS NULL OR v_subject_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'The selected subject does not belong to this school';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'assessments' THEN
    IF NEW.formative IS NULL OR NEW.summative IS NULL THEN
      RAISE EXCEPTION 'Both formative and summative marks are required before saving';
    END IF;
    IF NEW.teacher_initials IS NULL OR btrim(NEW.teacher_initials) = '' THEN
      RAISE EXCEPTION 'Teacher initials are required before saving marks';
    END IF;
    IF NEW.submitted_by IS NULL THEN
      RAISE EXCEPTION 'A teacher or authorised staff member is required before saving marks';
    END IF;

    SELECT school_id, class_id, stream_id
    INTO v_student_school_id, v_student_class_id, v_student_stream_id
    FROM public.students
    WHERE id = NEW.student_id;
    IF v_student_school_id IS NULL OR v_student_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'The selected learner does not belong to this school';
    END IF;
    PERFORM public.validate_class_stream_relation(
      NEW.school_id,
      v_student_class_id,
      v_student_stream_id
    );

    SELECT school_id INTO v_subject_school_id
    FROM public.subjects
    WHERE id = NEW.subject_id;
    IF v_subject_school_id IS NULL OR v_subject_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'The selected subject does not belong to this school';
    END IF;

    SELECT school_id INTO v_term_school_id
    FROM public.terms
    WHERE id = NEW.term_id;
    IF v_term_school_id IS NULL OR v_term_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'The selected term does not belong to this school';
    END IF;

    SELECT school_id INTO v_teacher_school_id
    FROM public.profiles
    WHERE id = NEW.submitted_by;
    IF v_teacher_school_id IS NULL OR v_teacher_school_id <> NEW.school_id THEN
      RAISE EXCEPTION 'The submitting teacher does not belong to this school';
    END IF;

    -- Subject/class/stream teachers must have an allocation for the exact
    -- learner scope. School leadership may enter marks without an allocation,
    -- but the submitting profile is still mandatory and school-scoped.
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.submitted_by
        AND ur.role IN ('subject_teacher', 'class_teacher', 'dos')
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.teacher_allocations ta
      WHERE ta.school_id = NEW.school_id
        AND ta.teacher_id = NEW.submitted_by
        AND ta.subject_id = NEW.subject_id
        AND (ta.class_id IS NULL OR ta.class_id = v_student_class_id)
        AND (ta.stream_id IS NULL OR ta.stream_id = v_student_stream_id)
    ) THEN
      RAISE EXCEPTION 'Allocate the teacher to this learner class, stream and subject first';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_stream_teacher_relationship ON public.streams;
CREATE TRIGGER validate_stream_teacher_relationship
BEFORE INSERT OR UPDATE OF school_id, class_id, stream_teacher_id ON public.streams
FOR EACH ROW EXECUTE FUNCTION public.validate_academic_relationships();

DROP TRIGGER IF EXISTS validate_student_academic_relationships ON public.students;
CREATE TRIGGER validate_student_academic_relationships
BEFORE INSERT OR UPDATE OF school_id, class_id, stream_id ON public.students
FOR EACH ROW EXECUTE FUNCTION public.validate_academic_relationships();

DROP TRIGGER IF EXISTS validate_teacher_allocation_relationships ON public.teacher_allocations;
CREATE TRIGGER validate_teacher_allocation_relationships
BEFORE INSERT OR UPDATE ON public.teacher_allocations
FOR EACH ROW EXECUTE FUNCTION public.validate_academic_relationships();

DROP TRIGGER IF EXISTS validate_assessment_relationships ON public.assessments;
CREATE TRIGGER validate_assessment_relationships
BEFORE INSERT OR UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_academic_relationships();

CREATE INDEX IF NOT EXISTS teacher_allocations_scope_idx
  ON public.teacher_allocations (school_id, teacher_id, subject_id, class_id, stream_id);
CREATE INDEX IF NOT EXISTS assessments_relationship_idx
  ON public.assessments (school_id, student_id, subject_id, term_id, submitted_by);
