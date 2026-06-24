# Demo web UI image. Reuses client/dfs.ts, so it needs both `web` and `client`.
# Express is already in the repo's package.json — install it (omit dev deps).
# Node 24 runs the .ts sources directly via type stripping; no build step.
FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY client ./client
COPY web ./web
RUN chown -R node:node /app
USER node

ENV NAMING_URL=http://naming-server:8000 \
    PORT=3000
EXPOSE 3000

CMD ["node", "web/server.ts"]
