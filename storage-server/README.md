# Storage Server (Mayda)

Stores chunk bytes as plain files on disk. The naming server keeps metadata
only; the actual bytes live here, one file per `chunk_id`. Several instances
run on different ports/addresses, and the client uploads each chunk to ≥2 of
them for replication.

## API

| Method | Route | Description |
|--------|-------|-------------|
| `PUT` | `/chunks/{chunk_id}` | Store raw chunk bytes (request body is the raw bytes). → `201 {status, chunk_id, size}` |
| `GET` | `/chunks/{chunk_id}` | Return the raw chunk bytes (`application/octet-stream`). → `200` / `404` |
| `DELETE` | `/chunks/{chunk_id}` | Delete the chunk (idempotent). → `200 {status, chunk_id, existed}` |
| `GET` | `/health` | Liveness. → `200 {status, address}` |

`chunk_id` must match `^[A-Za-z0-9._-]+$`; anything else returns `400` (prevents
path traversal). Chunks are written to `DATA_DIR/{chunk_id}`.

## Naming-server registration

On startup (and every `HEARTBEAT_SECONDS`) the server calls
`POST {NAMING_SERVER_URL}/storage/register` with `{ "address": SELF_ADDRESS }`,
matching the contract in `../API.md`. Registration failures are logged, not
fatal. Set `NAMING_SERVER_URL=` (empty) to disable it.

## Configuration (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `8001` | port to listen on |
| `DATA_DIR` | `./data` | directory where chunk files are written |
| `SELF_ADDRESS` | `localhost:PORT` | address other containers reach this server on (e.g. `storage1:8001`) |
| `NAMING_SERVER_URL` | `http://naming-server:8000` | naming server to register with (empty = disable) |
| `HEARTBEAT_SECONDS` | `15` | how often to refresh registration |

## Run locally

```bash
npm install                       # from the repo root (express)

# one instance, no naming server (standalone)
PORT=8001 DATA_DIR=./data-1 NAMING_SERVER_URL= node storage-server/server.ts

# several instances (different port + address + data dir)
PORT=8001 SELF_ADDRESS=storage1:8001 DATA_DIR=./data-1 node storage-server/server.ts
PORT=8002 SELF_ADDRESS=storage2:8002 DATA_DIR=./data-2 node storage-server/server.ts
PORT=8003 SELF_ADDRESS=storage3:8003 DATA_DIR=./data-3 node storage-server/server.ts
```

Example:

```bash
curl -X PUT  --data-binary "hello" http://localhost:8001/chunks/ab12
curl         http://localhost:8001/chunks/ab12          # -> hello
curl -X DELETE http://localhost:8001/chunks/ab12
```

## Test

```bash
node --test storage-server/test/*.test.ts
```

## Docker (baseline — Nikita owns the final wiring)

`Dockerfile` builds the image; in `docker-compose.yml` run ≥3 instances with
different `SELF_ADDRESS`/`PORT` and a volume each, all on the naming server's
network. See `Dockerfile` for the env contract.
