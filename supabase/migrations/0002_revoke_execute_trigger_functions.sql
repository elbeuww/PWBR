-- Migration 0002 : hygiène advisors — révoquer EXECUTE sur les fonctions SECURITY DEFINER
-- get_advisors (security) signale handle_new_user et rls_auto_enable comme exécutables
-- par anon/authenticated via /rest/v1/rpc. Les fonctions trigger/event_trigger ne sont
-- pas réellement invocables hors trigger (Postgres refuse), mais la révocation fait
-- disparaître la surface RPC et les WARN (lint 0028/0029).

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
