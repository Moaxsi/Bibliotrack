-- Additive only. The existing seven application tables and their data stay intact.
CREATE TABLE IF NOT EXISTS public.portadas_cloud (
    id uuid PRIMARY KEY,
    content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/gif')),
    contenido bytea NOT NULL CHECK (octet_length(contenido) BETWEEN 1 AND 1048576),
    fecha_creacion timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portadas_cloud ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portadas_cloud FROM anon, authenticated;
