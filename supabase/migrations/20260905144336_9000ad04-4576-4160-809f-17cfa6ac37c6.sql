-- DEMO ONLY -----------------------------------------------------------------
-- Portfolio/demo application with no authentication yet.
-- The policies below grant anonymous (public) read/insert/update access so the
-- frontend can demonstrate the workflow. THEY MUST BE REPLACED with
-- authenticated, user-scoped policies (auth.uid() based) before production.
-- RLS stays enabled; no table structure is changed.
-------------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.invoices TO anon, authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DEMO ONLY - anyone can read invoices" ON public.invoices;
CREATE POLICY "DEMO ONLY - anyone can read invoices"
  ON public.invoices FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "DEMO ONLY - anyone can insert invoices" ON public.invoices;
CREATE POLICY "DEMO ONLY - anyone can insert invoices"
  ON public.invoices FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "DEMO ONLY - anyone can update invoices" ON public.invoices;
CREATE POLICY "DEMO ONLY - anyone can update invoices"
  ON public.invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- DEMO ONLY storage policies for the private "invoices" bucket.
DROP POLICY IF EXISTS "DEMO ONLY - read invoice pdfs" ON storage.objects;
CREATE POLICY "DEMO ONLY - read invoice pdfs"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS "DEMO ONLY - upload invoice pdfs" ON storage.objects;
CREATE POLICY "DEMO ONLY - upload invoice pdfs"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'invoices');