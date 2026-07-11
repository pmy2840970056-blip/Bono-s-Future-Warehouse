
-- Invite codes table (whitelist-based signup gate)
CREATE TABLE public.invite_codes (
  code text PRIMARY KEY,
  note text,
  max_uses integer NOT NULL DEFAULT 1,
  uses_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT ALL ON public.invite_codes TO service_role;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: only accessible via SECURITY DEFINER trigger

-- Redemption log
CREATE TABLE public.invite_redemptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invite_redemptions TO authenticated;
GRANT ALL ON public.invite_redemptions TO service_role;
ALTER TABLE public.invite_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own redemption" ON public.invite_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Rewrite handle_new_user to enforce invite code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_row public.invite_codes;
BEGIN
  v_code := upper(trim(coalesce(NEW.raw_user_meta_data->>'invite_code', '')));

  IF v_code = '' THEN
    RAISE EXCEPTION 'INVITE_CODE_REQUIRED' USING HINT = '注册需要邀请码';
  END IF;

  SELECT * INTO v_row FROM public.invite_codes
    WHERE code = v_code AND active = true
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_CODE_INVALID' USING HINT = '邀请码无效';
  END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RAISE EXCEPTION 'INVITE_CODE_EXPIRED' USING HINT = '邀请码已过期';
  END IF;
  IF v_row.uses_count >= v_row.max_uses THEN
    RAISE EXCEPTION 'INVITE_CODE_EXHAUSTED' USING HINT = '邀请码已用完';
  END IF;

  UPDATE public.invite_codes SET uses_count = uses_count + 1 WHERE code = v_code;
  INSERT INTO public.invite_redemptions (user_id, code) VALUES (NEW.id, v_code);

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Seed initial codes for the owner to share
INSERT INTO public.invite_codes (code, note, max_uses) VALUES
  ('FRIEND2026', '首批朋友通用码', 30),
  ('FAMILY', '家人专用', 10),
  ('EARLYBIRD', '早鸟测试者', 20)
ON CONFLICT (code) DO NOTHING;
