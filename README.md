# Naming Server

Central metadata service for the distributed file system (Jhulian's component).
It is the single source of truth for **where every chunk lives** — it stores
metadata only, never chunk bytes.

Written in **TypeScript**, run directly with **Node.js** (no build step — Node
24 strips types at load time) using Express + the built-in **`node:sqlite`**
module, so there are no native dependencies to compile.

## What it does

- Maps `file -> ordered chunks -> replicas -> storage servers` in SQLite.
- Exposes a REST API for the client (create/read/delete/size).
- Maintains a registry of available storage servers.

## Requirements

- Node.js **>= 22.6** (TypeScript type stripping; default-on from 22.18 / 24).
  The Docker image pins `node:24-slim`.

## Run locally

```bash
npm install
PORT=8000 NAMING_DB_PATH=./naming.db npm start    # node src/server.ts
```

## Run in Docker

```bash
docker build -t naming-server .
docker run -p 8000:8000 -v naming_data:/data naming-server
```

## Configuration

| Env var          | Default           | Purpose                    |
| ---------------- | ----------------- | -------------------------- |
| `PORT`           | `8000`            | HTTP port                  |
| `NAMING_DB_PATH` | `/data/naming.db` | SQLite file (use a volume) |

## Develop

```bash
npm run typecheck   # tsc --noEmit (real type checking)
npm test            # node --test over the .ts test files (unit + e2e)
```

## API

See [API.md](API.md) — the contract shared with Alberto (client) and Mayda
(storage servers). It is unchanged by the internal refactor.

## Architecture

The code follows **Clean Architecture**: dependencies point inward, and each
layer knows only the one beneath it. The domain has no idea Express or SQLite
exist.

```
interfaces/http  ──►  application  ──►  domain  ◄──  infrastructure
 (controllers,        (use-cases /     (entities,     (SQLite adapters,
  DTOs, validation)    services)        ports, errors)  system clock)
```

- **domain/** — entities, domain errors, and _ports_ (the `FileRepository`,
  `StorageRepository`, `Clock` interfaces). Depends on nothing.
- **application/** — use-cases (`FileService`, `StorageService`). Orchestrates
  the domain through ports; no SQL, no HTTP.
- **infrastructure/** — adapters that implement the ports (`SqliteFileRepository`,
  `SqliteStorageRepository`, `SystemClock`). The only code that writes SQL.
- **interfaces/http/** — Express controllers, request validation, DTO mapping
  (snake_case wire ↔ camelCase domain), and the central error handler.
- **container.ts** — composition root: the single place that wires concrete
  adapters to services. `server.ts` only loads config and starts listening.

**Why it scales:** swapping SQLite for PostgreSQL means writing one new adapter
and changing one line in `container.ts` — no use-case or controller touched.
Ports are async so a network-backed store fits the same contract. Business
rules are unit-tested with in-memory fakes (`test/file-service.test.ts`), no DB
or HTTP required.

## Files

```
src/
├── config.ts                          env config (one place)
├── container.ts                       composition root (DI wiring)
├── server.ts                          entry point
├── domain/
│   ├── entities.ts                    Chunk, StoredFile, StorageServer
│   ├── errors.ts                      domain errors -> mapped to HTTP later
│   └── ports/                         FileRepository, StorageRepository, Clock
├── application/
│   ├── file-service.ts                file use-cases
│   └── storage-service.ts             storage-registry use-cases
├── infrastructure/
│   ├── system-clock.ts                Clock adapter
│   └── sqlite/                        connection + repository adapters
└── interfaces/http/
    ├── app.ts                         builds the Express app from deps
    ├── file-controller.ts             /files routes
    ├── storage-controller.ts          /storage routes
    ├── validators.ts                  body -> validated command
    ├── dto.ts                         wire <-> domain mapping
    ├── async-handler.ts               forwards async errors to middleware
    └── error-handler.ts               domain error -> HTTP status
test/
├── naming_server.test.ts              end-to-end over HTTP (in-memory DB)
└── file-service.test.ts               pure unit tests (fakes, no DB/HTTP)
schema.sql                             metadata schema
```
