# Storage server image — one image, reused for every storage-N instance.
# Owned by Nikita (infrastructure); baseline by Mayda.
#
# Node 24 runs the TypeScript sources directly via built-in type stripping, so
# there is no build step. Per-instance settings (SELF_ADDRESS, the named volume)
# are injected by docker-compose; the image itself is identical for all three.
#
# Build context is the repo root (see docker-compose.yml) so the shared
# package.json / lockfile resolve.
FROM node:24-slim

WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Only what the storage server needs at runtime.
COPY storage-server ./storage-server

# Chunk bytes live on a volume so they survive restarts; create + own it as the
# non-root `node` user. A named volume first mounted here inherits these perms.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

# SELF_ADDRESS is set per-instance in docker-compose (e.g. storage-1:8001) — it
# is the host:port other containers use to reach THIS server for chunks.
ENV PORT=8001 \
    DATA_DIR=/data \
    NAMING_SERVER_URL=http://naming-server:8000 \
    HEARTBEAT_SECONDS=15
VOLUME ["/data"]
EXPOSE 8001

CMD ["node", "storage-server/server.ts"]
