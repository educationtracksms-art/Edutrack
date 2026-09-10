-- Indexes for the shared identity and notification queries used on nearly
-- every authenticated page. IF NOT EXISTS keeps this safe to re-run.
CREATE INDEX IF NOT EXISTS profiles_school_id_idx
  ON public.profiles (school_id);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx
  ON public.user_roles (user_id);

CREATE INDEX IF NOT EXISTS notifications_user_unread_created_idx
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS feature_toggles_school_module_idx
  ON public.feature_toggles (school_id, module);
