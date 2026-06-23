# Storage server image. Baseline provided by Mayda; Nikita (infrastructure)
# owns the final Docker/compose wiring.
#
# Node 24 runs the TypeScript sources directly via built-in type stripping,
# so there is no build step.
FROM node:24-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Chunk bytes live on a volume so they survive container restarts.
ENV DATA_DIR=/data
ENV PORT=8001
# SELF_ADDRESS and NAMING_SERVER_URL are set per-instance in docker-compose,
# e.g. SELF_ADDRESS=storage1:8001, NAMING_SERVER_URL=http://naming-server:8000
VOLUME ["/data"]
EXPOSE 8001

CMD ["node", "storage-server/server.ts"]
