# Distributed File System

Repository for a chunked, replicated distributed file system with three main
parts:

- **Naming server (Jhulian)**: metadata and storage-registry authority.
- **Storage servers (Mayda)**: chunk byte storage (`PUT/GET/DELETE /chunks/:id`).
- **Client CLI (Alberto)**: file chunking, replication, read reassembly, delete, size.

## Bring the system up

Use the infrastructure guide from Nikita:

- `SETUP.md` (Docker bring-up, network contract, health checks, smoke test)

Quick start:

```bash
docker compose up --build -d
docker compose ps
```

## Usage instructions

Concrete client operation guide with examples:

- `USAGE.md`

Additional client details:

- `client/README.md`

Quick examples:

```bash
docker compose run --rm client create /files/report.txt report.txt
docker compose run --rm client size report.txt
docker compose run --rm client read report.txt /files/out.txt
docker compose run --rm client delete report.txt
```

## Required documentation

- **Architecture document**: `ARCHITECTURE.md`
  - system diagram
  - operation flows (create/read/delete/size)
  - design decisions and trade-offs
  - fault-tolerance analysis
- **API contract**: `API.md`
- **Integration findings log**: `test/INTEGRATION_BUG_REPORT.md`

## Repository structure

```text
.
├── src/                                  naming server source
│   ├── application/                      file/storage use-cases
│   ├── domain/                           entities, errors, ports
│   ├── infrastructure/                   sqlite + clock adapters
│   └── interfaces/http/                  Express controllers and middleware
├── storage-server/                       storage node implementation
├── client/                               client CLI implementation
├── test/                                 unit + integration suites
│   ├── helpers/e2e-harness.ts            shared e2e orchestration
│   ├── e2e.client.integration.test.ts    client-owner integration suite
│   ├── e2e.naming.integration.test.ts    naming-owner integration suite
│   ├── e2e.storage.integration.test.ts   storage-owner integration suite
│   └── INTEGRATION_BUG_REPORT.md         file-based bug coordination log
├── schema.sql                            naming metadata schema
├── SETUP.md                              docker/infrastructure guide
├── USAGE.md                              client command examples
├── ARCHITECTURE.md                       architecture + fault-tolerance
└── API.md                                naming-server API contract
```

## Development

```bash
npm install
npm run typecheck
npm test
```
