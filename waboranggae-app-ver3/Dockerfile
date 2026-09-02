# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate \
  && sed -i 's/\r$//' docker/api-entrypoint.sh \
  && chmod +x docker/api-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

ENTRYPOINT ["sh", "./docker/api-entrypoint.sh"]
