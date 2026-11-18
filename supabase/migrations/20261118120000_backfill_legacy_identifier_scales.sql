-- Preserve identifier bands created before grading_identifier_scales became
-- the report and grading UI source of truth.
DO $$
BEGIN
  IF to_regclass('public.identifier_scales') IS NOT NULL
    AND to_regclass('public.grading_identifier_scales') IS NOT NULL THEN
    INSERT INTO public.grading_identifier_scales (
      school_id,
      identifier,
      min_score,
      max_score,
      descriptor
    )
    SELECT
      legacy.school_id,
      legacy.identifier,
      legacy.min_score,
      legacy.max_score,
      legacy.descriptor
    FROM public.identifier_scales AS legacy
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.grading_identifier_scales AS current_scale
      WHERE current_scale.school_id = legacy.school_id
        AND current_scale.identifier = legacy.identifier
        AND current_scale.min_score = legacy.min_score
        AND current_scale.max_score = legacy.max_score
    );
  END IF;
END $$;
