# Naming server (metadata) image — owned by Nikita (infrastructure).
#
# Node 24 runs the TypeScript sources directly via built-in type stripping, so
# there is no build step and no typescript toolchain at runtime. SQLite is the
# built-in `node:sqlite` module — no native add-ons, no compiler needed.
#
# Build context is the repo root (see docker-compose.yml) because the metadata
# schema (schema.sql) lives there and is read at startup.
FROM node:24-slim

WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Only what the naming server needs at runtime.
COPY src ./src
COPY schema.sql ./schema.sql

# Metadata DB lives on a volume so it survives restarts; create + own it as the
# non-root `node` user (uid 1000, already present in the base image). A named
# volume first mounted here inherits these perms.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV PORT=8000 \
    NAMING_DB_PATH=/data/naming.db
VOLUME ["/data"]
EXPOSE 8000

CMD ["node", "src/server.ts"]
