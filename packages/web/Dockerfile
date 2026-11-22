# Build a partir da RAIZ do repositório (context "."), pois depende de engine e shared.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile --filter @warii/web...

COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY packages/shared packages/shared
COPY packages/web packages/web
RUN pnpm --filter @warii/web build

FROM nginx:alpine
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
