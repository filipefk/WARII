# Build a partir da RAIZ do repositório (context "."), pois depende de engine e shared.

# ---- build: todas as dependências, gera dist/ (engine e shared entram no bundle) ----
FROM node:24-alpine AS build
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
# As migrations (packages/server/drizzle) vêm no COPY acima e o servidor as aplica ao iniciar
# (dist/../drizzle). Falha o build da imagem se a pasta não vier.
RUN test -f packages/server/drizzle/meta/_journal.json

# ---- produção: só dependências de produção, o bundle e as migrations, sem root ----
FROM node:24-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --prod --filter @warii/server... \
  && pnpm store prune \
  && rm -rf /root/.cache /root/.local/share/pnpm

COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/drizzle packages/server/drizzle

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/packages/server
# Arquivos continuam do root (só leitura para o processo); o servidor roda como "node".
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Mapas de código no stack trace dos erros (apontam para o TypeScript).
CMD ["node", "--enable-source-maps", "dist/index.js"]
