CREATE TABLE auth_revocations (
  session_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX auth_revocations_expires_at_idx ON auth_revocations(expires_at);
ALTER TABLE auth_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE auth_revocations FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=client_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE auth_revocations FROM %I',client_role);
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='waboranggae_api') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON auth_revocations TO waboranggae_api;
    CREATE POLICY waboranggae_api_access ON auth_revocations TO waboranggae_api USING(true) WITH CHECK(true);
  END IF;
END $$;

