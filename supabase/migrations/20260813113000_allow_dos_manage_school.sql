CREATE OR REPLACE FUNCTION public.can_manage_school()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','school_admin','head_teacher','deputy_head_teacher','dos')
  );
$$;
