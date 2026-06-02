# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter @ttt/server... --filter @ttt/shared

FROM deps AS build
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/
RUN pnpm --filter @ttt/shared build \
 && pnpm --filter @ttt/server build

FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/server/dist ./apps/server/dist
RUN pnpm install --prod --frozen-lockfile --filter @ttt/server... --filter @ttt/shared
EXPOSE 3001
USER node
CMD ["node", "apps/server/dist/server.js"]
