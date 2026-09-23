-- Security posture introspection.
--
-- Exposes read-only counts derived from the Postgres catalog so the Admin
-- Security Center can verify (rather than hardcode) that Row Level Security is
-- configured. SECURITY DEFINER lets the API call it through the service role;
-- it returns only aggregate counts and never row data, so it leaks nothing
-- sensitive.

CREATE OR REPLACE FUNCTION public.get_security_posture()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'rls_enabled_tables', (
      SELECT count(*)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
    ),
    'total_tables', (
      SELECT count(*)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ),
    'rls_policies', (
      SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
    ),
    'audit_log_count', (
      SELECT count(*) FROM public.audit_logs
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_security_posture() TO service_role, authenticated;
