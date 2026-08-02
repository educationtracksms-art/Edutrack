-- ===== LIBRARY =====
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  shelf_location text,
  total_copies int NOT NULL DEFAULT 1,
  available_copies int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  borrower_type text NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at date,
  returned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX library_books_school_id_idx ON public.library_books (school_id);
CREATE INDEX library_loans_school_id_idx ON public.library_loans (school_id);
CREATE INDEX library_loans_book_id_idx ON public.library_loans (book_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_loans TO authenticated;
GRANT ALL ON public.library_loans TO service_role;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY library_books_read ON public.library_books FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());
CREATE POLICY library_books_write ON public.library_books FOR INSERT TO authenticated
  WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY library_books_update ON public.library_books FOR UPDATE TO authenticated
  USING (school_id = public.current_school_id() AND public.can_manage_school())
  WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY library_books_delete ON public.library_books FOR DELETE TO authenticated
  USING (school_id = public.current_school_id() AND public.can_manage_school());

CREATE POLICY library_loans_read ON public.library_loans FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());
CREATE POLICY library_loans_write ON public.library_loans FOR INSERT TO authenticated
  WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY library_loans_update ON public.library_loans FOR UPDATE TO authenticated
  USING (school_id = public.current_school_id() AND public.can_manage_school())
  WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY library_loans_delete ON public.library_loans FOR DELETE TO authenticated
  USING (school_id = public.current_school_id() AND public.can_manage_school());
