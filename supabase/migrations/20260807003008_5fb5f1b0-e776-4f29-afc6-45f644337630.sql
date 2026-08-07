CREATE TABLE public.invite_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  purpose text NOT NULL,
  code text NOT NULL,
  ip_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.invite_applications TO service_role;

ALTER TABLE public.invite_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny client select on invite_applications" ON public.invite_applications FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny client insert on invite_applications" ON public.invite_applications FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client update on invite_applications" ON public.invite_applications FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client delete on invite_applications" ON public.invite_applications FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX idx_invite_applications_created_at ON public.invite_applications (created_at DESC);

CREATE OR REPLACE FUNCTION public.claim_invite_code(_email text, _purpose text, _ip_hash text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_existing text;
  v_code text;
BEGIN
  v_email := lower(trim(coalesce(_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED';
  END IF;

  SELECT code INTO v_existing FROM public.invite_applications WHERE email = v_email;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT code INTO v_code
  FROM public.invite_codes
  WHERE active = true
    AND uses_count < max_uses
    AND (expires_at IS NULL OR expires_at > now())
    AND code NOT IN (SELECT code FROM public.invite_applications)
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_code IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.invite_applications (email, purpose, code, ip_hash)
  VALUES (v_email, left(coalesce(_purpose, ''), 200), v_code, _ip_hash)
  ON CONFLICT (email) DO NOTHING;

  SELECT code INTO v_existing FROM public.invite_applications WHERE email = v_email;
  RETURN v_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_invite_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_invite_code(text, text, text) TO service_role;