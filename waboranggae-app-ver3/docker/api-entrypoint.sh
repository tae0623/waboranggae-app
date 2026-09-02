#!/bin/sh
set -e

echo "[api] waiting for database..."
until node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 1
done

echo "[api] running prisma migrate deploy..."
npx prisma migrate deploy

echo "[api] starting server..."
exec npx tsx server/index.ts
