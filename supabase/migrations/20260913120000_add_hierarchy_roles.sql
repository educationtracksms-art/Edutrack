-- Keep the roles shown in the Users & Roles hierarchy assignable at the database layer.
-- Bursar already exists; these roles are used by the current application UI.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hod';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'librarian';
