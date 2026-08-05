ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS stream_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_streams_stream_teacher ON public.streams(stream_teacher_id);
