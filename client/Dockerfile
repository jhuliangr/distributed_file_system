# Client (CLI) image — owned by Nikita (infrastructure).
#
# The client is a single TypeScript file with ZERO npm dependencies (only Node
# built-ins: fetch, node:crypto, node:fs). So there is no `npm ci` step at all —
# nothing to install. Node 24 runs the .ts source directly via type stripping.
#
# ENTRYPOINT is the CLI itself, so `docker compose run --rm client <cmd> <args>`
# passes <cmd> <args> straight through (create / read / delete / size).
FROM node:24-slim

WORKDIR /app
COPY client ./client
RUN chown -R node:node /app
USER node

# Where the client finds the naming server. NOTE: the variable is NAMING_URL
# (not NAMING_SERVER_URL) — that is what client/dfs.ts reads.
ENV NAMING_URL=http://naming-server:8000

ENTRYPOINT ["node", "client/dfs.ts"]
# No CMD: running with no args prints usage.
