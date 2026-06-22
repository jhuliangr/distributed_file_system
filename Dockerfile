# Starter Dockerfile for the naming server.
# Owned by Nikita (infrastructure) — provided here as a working baseline so
# the service runs out of the box and the port/env contract is explicit.
#
# Node 24 runs the TypeScript sources directly via built-in type stripping,
# so there is no build step and no need to install the typescript toolchain.
FROM node:24-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Metadata DB lives on a volume so it survives container restarts.
ENV NAMING_DB_PATH=/data/naming.db
ENV PORT=8000
VOLUME ["/data"]
EXPOSE 8000

CMD ["node", "src/server.ts"]
