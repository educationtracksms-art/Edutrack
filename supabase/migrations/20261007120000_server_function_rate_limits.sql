CREATE TABLE public.server_function_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 121)
);

ALTER TABLE public.server_function_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.server_function_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_server_function_rate_limit()
RETURNS TABLE (allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_window_started_at timestamptz := date_trunc('minute', statement_timestamp());
  v_request_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.server_function_rate_limits AS limits (
    user_id,
    window_started_at,
    request_count
  )
  VALUES (v_user_id, v_window_started_at, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_started_at = EXCLUDED.window_started_at,
        request_count = CASE
          WHEN limits.window_started_at = EXCLUDED.window_started_at
            THEN LEAST(limits.request_count + 1, 121)
          ELSE 1
        END
  RETURNING request_count INTO v_request_count;

  RETURN QUERY
    SELECT
      v_request_count <= 120,
      GREATEST(120 - v_request_count, 0),
      v_window_started_at + interval '1 minute';
END;
$$;

REVOKE ALL ON FUNCTION public.consume_server_function_rate_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_server_function_rate_limit() TO authenticated;
