FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.32.1 --activate \
  && pnpm config set store-dir /pnpm/store

WORKDIR /app

# Lockfile and manifests only. Source changes do not rerun this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN --mount=type=cache,id=vemoki-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter @ticket/api... \
      --filter @ticket/web... \
      --filter @ticket/worker...

COPY tsconfig.base.json ./
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/web/app apps/web/app
COPY apps/web/src apps/web/src
COPY apps/web/proxy.ts apps/web/proxy.ts
COPY apps/web/next.config.ts apps/web/next.config.ts
COPY apps/web/next-env.d.ts apps/web/next-env.d.ts
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY apps/worker/src apps/worker/src
COPY apps/worker/tsconfig.json apps/worker/tsconfig.json
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY packages/backend/src packages/backend/src
COPY packages/backend/prisma packages/backend/prisma
COPY packages/backend/prisma.config.ts packages/backend/prisma.config.ts
COPY packages/backend/tsconfig.json packages/backend/tsconfig.json

ENV NODE_ENV=production
# contracts has no local typescript; compile it with the toolchain already installed for api.
RUN pnpm --filter @ticket/api exec tsc -p ../../packages/contracts/tsconfig.json \
  && pnpm --filter @ticket/backend build \
  && pnpm --filter @ticket/api build \
  && pnpm --filter @ticket/web build \
  && pnpm --filter @ticket/worker build
