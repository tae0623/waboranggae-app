CREATE TABLE "oauth_identities" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_identities_provider_subject_key" ON "oauth_identities"("provider", "subject");
CREATE INDEX "oauth_identities_userId_idx" ON "oauth_identities"("userId");
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
