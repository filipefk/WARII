# Build a partir da RAIZ do repositório (context "."), pois depende de engine e shared.
FROM node:24-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter @warii/server...

COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY packages/shared packages/shared
COPY packages/server packages/server
RUN pnpm --filter @warii/server build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/packages/server
CMD ["node", "dist/index.js"]
