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
  SELECT p_school_id = public.current_school_id()
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
    );
$$;

CREATE OR REPLACE FUNCTION public.can_enter_assessment(
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
  SELECT p_school_id = public.current_school_id()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = p_school_id
        AND ur.role IN (
          'super_admin', 'school_admin', 'head_teacher', 'deputy_head_teacher',
          'dos', 'hod', 'class_teacher', 'subject_teacher'
        )
    )
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.school_id = p_school_id
          AND ur.role IN (
            'head_teacher', 'deputy_head_teacher', 'dos', 'hod',
            'class_teacher', 'subject_teacher'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.teacher_allocations ta
        JOIN public.students st
          ON st.id = p_student_id
         AND st.school_id = p_school_id
         AND (ta.class_id IS NULL OR ta.class_id = st.class_id)
         AND (ta.stream_id IS NULL OR ta.stream_id = st.stream_id)
        WHERE ta.school_id = p_school_id
          AND ta.teacher_id = auth.uid()
          AND ta.subject_id = p_subject_id
          AND ta.paper_id IS NOT DISTINCT FROM p_paper_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_assessment(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_school_id = public.current_school_id()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = p_school_id
        AND ur.role IN (
          'super_admin', 'school_admin', 'head_teacher', 'deputy_head_teacher', 'dos'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_assessment(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_enter_assessment(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_assessment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_assessment(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_enter_assessment(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_assessment(uuid) TO authenticated;

CREATE POLICY assessments_access_scope_select
ON public.assessments AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.can_view_assessment(school_id, student_id, subject_id, paper_id)
);

CREATE POLICY assessments_access_scope_insert
ON public.assessments AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
  AND submitted_by = auth.uid()
  AND status IN ('draft', 'submitted')
  AND NOT locked
  AND approved_by IS NULL
  AND approved_at IS NULL
);

CREATE POLICY assessments_access_scope_update
ON public.assessments AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR (
      public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
      AND status IN ('draft', 'rejected')
      AND NOT locked
    )
  )
)
WITH CHECK (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR (
      public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
      AND status IN ('draft', 'rejected', 'submitted')
      AND NOT locked
    )
  )
);

CREATE POLICY assessments_access_scope_delete
ON public.assessments AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR (
      public.can_view_assessment(school_id, student_id, subject_id, paper_id)
      AND status IN ('draft', 'rejected')
      AND NOT locked
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.school_id = public.current_school_id()
          AND ur.role IN (
            'class_teacher', 'subject_teacher', 'dos',
            'head_teacher', 'deputy_head_teacher'
          )
      )
    )
  )
);

CREATE POLICY formative_marks_access_scope_select
ON public.formative_marks AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.can_view_assessment(school_id, student_id, subject_id, paper_id)
);

CREATE POLICY formative_marks_access_scope_insert
ON public.formative_marks AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
  )
  AND status = 'draft'
  AND NOT locked
  AND submitted_by = auth.uid()
);

CREATE POLICY formative_marks_access_scope_update
ON public.formative_marks AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
  )
)
WITH CHECK (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
  )
);
