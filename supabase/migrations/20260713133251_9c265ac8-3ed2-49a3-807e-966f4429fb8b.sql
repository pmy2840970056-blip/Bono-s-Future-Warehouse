CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_row public.invite_codes;
  v_fallback_name text;
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

  -- Fallback display name: prefer meta, then email prefix, then phone last 4, then 'friend'
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    v_fallback_name := split_part(NEW.email, '@', 1);
  ELSIF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    v_fallback_name := '用户' || right(NEW.phone, 4);
  ELSE
    v_fallback_name := '新朋友';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    v_fallback_name
  ))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;