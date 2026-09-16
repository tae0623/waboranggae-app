-- App users authenticate through our API, not Supabase Auth/PostgREST.
-- No public Data API access to account, history, OAuth, quota or migration metadata.
-- The table-owning migration role remains able to serve the server-side API.
BEGIN;
DO $$
DECLARE table_name text; client_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','oauth_identities','bookmarks','search_history','oauth_flows','api_quota_buckets','_prisma_migrations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', table_name, client_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
