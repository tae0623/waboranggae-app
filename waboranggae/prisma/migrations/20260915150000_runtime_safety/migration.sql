-- Short-lived encrypted OAuth handshakes. Never expose these through a public data API.
CREATE TABLE "oauth_flows" (
  "id" TEXT PRIMARY KEY,
  "payload" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "oauth_flows_expires_at_idx" ON "oauth_flows" ("expires_at");
ALTER TABLE "oauth_flows" ENABLE ROW LEVEL SECURITY;

-- Shared atomic quota reservations survive API restarts and multiple instances.
CREATE TABLE "api_quota_buckets" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0 CHECK ("count" >= 0),
  "expires_at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "api_quota_buckets_expires_at_idx" ON "api_quota_buckets" ("expires_at");
ALTER TABLE "api_quota_buckets" ENABLE ROW LEVEL SECURITY;
