REVOKE ALL ON FUNCTION public.claim_invite_code(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_invite_code(text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;