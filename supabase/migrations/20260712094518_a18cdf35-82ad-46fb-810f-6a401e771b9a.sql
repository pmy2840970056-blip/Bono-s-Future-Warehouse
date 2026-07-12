
-- invite_codes: 明确拒绝所有客户端访问（读写皆无）；仅由 handle_new_user 触发器以 SECURITY DEFINER 身份访问
REVOKE ALL ON public.invite_codes FROM anon, authenticated;

CREATE POLICY "Deny client select on invite_codes"
  ON public.invite_codes FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny client insert on invite_codes"
  ON public.invite_codes FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client update on invite_codes"
  ON public.invite_codes FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client delete on invite_codes"
  ON public.invite_codes FOR DELETE TO anon, authenticated USING (false);

-- invite_redemptions: 用户只能读自己的记录，写入只允许通过服务端触发器进行
CREATE POLICY "Deny client insert on invite_redemptions"
  ON public.invite_redemptions FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client update on invite_redemptions"
  ON public.invite_redemptions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client delete on invite_redemptions"
  ON public.invite_redemptions FOR DELETE TO anon, authenticated USING (false);
