-- Nightly scanner (service_role): trailing 2-day absent streaks, idempotent.
CREATE OR REPLACE FUNCTION public.scan_absence_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; r record; v_parent_phone text; v_student_name text;
  v_school_name text; v_comm_id uuid; v_term uuid;
BEGIN
  FOR r IN
    SELECT a.school_id, a.student_id,
           (ARRAY_AGG(a.attendance_date ORDER BY a.attendance_date DESC))[1] AS latest_date,
           (ARRAY_AGG(a.attendance_date ORDER BY a.attendance_date DESC))[2] AS prev_date
    FROM public.attendance_records a
    WHERE a.status = 'absent'
    GROUP BY a.school_id, a.student_id
    HAVING COUNT(*) >= 2
       AND (ARRAY_AGG(a.attendance_date ORDER BY a.attendance_date DESC))[1] >= CURRENT_DATE - 1
       AND (ARRAY_AGG(a.attendance_date ORDER BY a.attendance_date DESC))[2]
           = (ARRAY_AGG(a.attendance_date ORDER BY a.attendance_date DESC))[1] - 1
  LOOP
    IF EXISTS (SELECT 1 FROM public.attendance_absence_alerts
               WHERE school_id = r.school_id AND student_id = r.student_id
                 AND streak_end_date = r.latest_date) THEN CONTINUE; END IF;
    SELECT s.full_name, COALESCE(s.parent_phone, s.guardian_phone),
           (SELECT name FROM public.schools WHERE id = s.school_id),
           (SELECT term_id FROM public.attendance_records
             WHERE school_id = r.school_id AND student_id = r.student_id
               AND attendance_date = r.latest_date LIMIT 1)
    INTO v_student_name, v_parent_phone, v_school_name, v_term
    FROM public.students s WHERE s.id = r.student_id;
    INSERT INTO public.finance_communications
      (school_id, student_id, recipient_type, recipient_name, recipient_address,
       channel, message_type, subject, body, entity_type, status)
    VALUES
      (r.school_id, r.student_id, 'parent', v_student_name, v_parent_phone,
       'sms', 'absence_alert',
       'Absence alert: ' || COALESCE(v_student_name, 'learner'),
       COALESCE(v_school_name, 'School') || ': ' || COALESCE(v_student_name, 'Learner')
         || ' was absent on ' || r.prev_date || ' and ' || r.latest_date
         || '. Please contact the school.',
       'attendance', 'queued')
    RETURNING id INTO v_comm_id;
    INSERT INTO public.notifications (school_id, user_id, title, body, type)
    SELECT r.school_id, p.id,
           'Absence alert: ' || COALESCE(v_student_name, 'learner'),
           COALESCE(v_student_name, 'Learner') || ' absent 2 days in a row ('
             || r.prev_date || ' - ' || r.latest_date || '). SMS queued'
             || CASE WHEN v_parent_phone IS NULL THEN ' (no parent phone on file)' ELSE '' END || '.',
           'attendance'
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.school_id = r.school_id
    WHERE p.school_id = r.school_id AND p.is_active
      AND ur.role IN ('class_teacher','dos','head_teacher','deputy_head_teacher','school_admin');
    INSERT INTO public.attendance_absence_alerts
      (school_id, student_id, term_id, streak_start_date, streak_end_date,
       consecutive_days, parent_phone, sms_communication_id)
    VALUES
      (r.school_id, r.student_id, v_term, r.prev_date, r.latest_date,
       2, v_parent_phone, v_comm_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.scan_absence_alerts() TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    PERFORM cron.schedule('attendance-absence-alerts', '30 5 * * *', 'SELECT public.scan_absence_alerts();');
  ELSE RAISE NOTICE 'pg_cron not installed: skipping attendance-absence-alerts schedule'; END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_function THEN RAISE NOTICE 'cron.schedule unavailable: skipping attendance-absence-alerts schedule';
END; $$;
