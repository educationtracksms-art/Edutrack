ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher ON public.classes(class_teacher_id);
