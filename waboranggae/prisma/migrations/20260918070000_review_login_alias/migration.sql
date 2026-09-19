ALTER TABLE users ADD COLUMN "loginAlias" TEXT;
CREATE UNIQUE INDEX "users_loginAlias_key" ON users("loginAlias");
ALTER TABLE users ADD CONSTRAINT users_login_alias_format
  CHECK ("loginAlias" IS NULL OR "loginAlias" ~ '^[a-z][a-z0-9_-]{2,31}$');
