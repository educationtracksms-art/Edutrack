CREATE OR REPLACE FUNCTION public.can_view_assessment(
  p_school_id uuid,
  p_student_id uuid,
  p_subject_id uuid,
  p_paper_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_super_admin()
    OR (
      p_school_id = public.current_school_id()
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.school_id = p_school_id
            AND ur.role IN (
              'super_admin', 'school_admin', 'head_teacher', 'deputy_head_teacher',
              'dos', 'hod'
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.students st
            ON st.id = p_student_id
           AND st.school_id = p_school_id
          JOIN public.classes c
            ON c.id = st.class_id
           AND c.school_id = p_school_id
          WHERE ur.user_id = auth.uid()
            AND ur.school_id = p_school_id
            AND ur.role = 'class_teacher'
            AND c.class_teacher_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.teacher_allocations ta
            ON ta.school_id = p_school_id
           AND ta.teacher_id = auth.uid()
           AND ta.subject_id = p_subject_id
           AND ta.paper_id IS NOT DISTINCT FROM p_paper_id
          JOIN public.students st
            ON st.id = p_student_id
           AND st.school_id = p_school_id
           AND (ta.class_id IS NULL OR ta.class_id = st.class_id)
           AND (ta.stream_id IS NULL OR ta.stream_id = st.stream_id)
          WHERE ur.user_id = auth.uid()
            AND ur.school_id = p_school_id
            AND ur.role IN ('subject_teacher', 'class_teacher')
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_assessment(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_assessment(uuid, uuid, uuid, uuid) TO authenticated;
