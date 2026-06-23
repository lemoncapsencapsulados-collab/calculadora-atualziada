CREATE POLICY "Authenticated can read email log"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.email_send_log TO authenticated;