-- Existing users are not assigned consent retroactively.
ALTER TABLE "users" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "users" ADD COLUMN "consentedAt" TIMESTAMP(3);
