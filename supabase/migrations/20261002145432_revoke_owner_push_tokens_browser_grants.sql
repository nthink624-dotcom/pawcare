-- Push tokens are read and written only by authenticated server routes using
-- service_role. Remove browser grants explicitly; RLS is defense in depth and
-- does not protect operations such as TRUNCATE.
revoke all privileges on table public.owner_push_tokens from public, anon, authenticated;
grant all privileges on table public.owner_push_tokens to service_role;

notify pgrst, 'reload schema';
