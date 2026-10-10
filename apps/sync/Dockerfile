# Built from the repo root (see `deploy:sync`), since apps/sync depends on packages/editor.
FROM node:24-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/sync/package.json apps/sync/
COPY packages/editor/package.json packages/editor/
# Dev dependencies included: the server runs through tsx.
RUN pnpm install --frozen-lockfile --filter @coscribe/sync...

COPY packages/editor packages/editor
COPY apps/sync apps/sync

ENV NODE_ENV=production PORT=1234
EXPOSE 1234
WORKDIR /app/apps/sync
CMD ["node", "--import", "tsx", "src/index.ts"]
