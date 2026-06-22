# Naming Server API Contract

Owner: **Jhulian**. This is the interface the client (**Alberto**) and the
storage servers (**Mayda**) code against. Base URL inside the docker network:
`http://naming-server:8000`.

All request/response bodies are JSON. Addresses are `"host:port"` strings
reachable on the docker-compose network (e.g. `storage1:8001`).

---

## Metadata model

```
file (name, size, num_chunks)
  └── chunk (index, chunk_id)        # ordered, 0-based
        └── replicas: [address, ...] # >= 2 storage servers per chunk
```

The naming server stores **only metadata** — never chunk bytes. Chunk bytes
live on the storage servers, keyed by `chunk_id`.

---

## Storage server registry (Mayda + Alberto)

### `POST /storage/register`

A storage server announces itself on startup and to refresh liveness.

```json
{ "address": "storage1:8001" }
```

→ `200 {"status": "registered", "address": "storage1:8001"}`

### `GET /storage`

List storage servers the client can upload to. Add `?all=1` to include dead ones.

```json
{ "servers": [{ "address": "storage1:8001", "alive": 1, "last_seen": "..." }] }
```

### `POST /storage/<address>/status`

Client reports a server it found unreachable (or recovered).

```json
{ "alive": false }
```

→ `200 {"address": "storage1:8001", "alive": false}`

---

## Files (Alberto)

### `POST /files` — register a new file and its chunk locations

```json
{
  "name": "report.txt",
  "size": 2048,
  "chunks": [
    {
      "chunk_id": "ab12",
      "index": 0,
      "replicas": ["storage1:8001", "storage2:8002"]
    },
    {
      "chunk_id": "cd34",
      "index": 1,
      "replicas": ["storage2:8002", "storage3:8003"]
    }
  ]
}
```

→ `201 {"status": "created", "name": "report.txt", "num_chunks": 2}`
→ `409` if a file with that name already exists
→ `400` on a malformed payload (see validation rules below)

### `GET /files/<name>` — chunk locations for read/reassembly

→ `200`

```json
{
  "name": "report.txt",
  "size": 2048,
  "num_chunks": 2,
  "created_at": "2026-06-22T12:00:00+00:00",
  "chunks": [
    {
      "index": 0,
      "chunk_id": "ab12",
      "replicas": ["storage1:8001", "storage2:8002"]
    },
    {
      "index": 1,
      "chunk_id": "cd34",
      "replicas": ["storage2:8002", "storage3:8003"]
    }
  ]
}
```

Chunks are returned ordered by `index`. The client downloads each chunk from
any replica (try the next on failure) and concatenates by index.
→ `404` if unknown.

### `GET /files/<name>/size` — size without transferring content

→ `200 {"name": "report.txt", "size": 2048}` · `404` if unknown.

### `DELETE /files/<name>` — remove metadata

Returns the chunk→server map that existed so the client can purge chunk bytes
from each storage server.
→ `200`

```json
{
  "status": "deleted",
  "name": "report.txt",
  "chunks": [
    {
      "index": 0,
      "chunk_id": "ab12",
      "replicas": ["storage1:8001", "storage2:8002"]
    },
    {
      "index": 1,
      "chunk_id": "cd34",
      "replicas": ["storage2:8002", "storage3:8003"]
    }
  ]
}
```

→ `404` if unknown.

---

## Validation rules for `POST /files`

- `name`: non-empty string, unique
- `size`: non-negative integer (total file size in bytes)
- `chunks`: non-empty list; each item has
  - `chunk_id`: non-empty string (globally unique; the client/Mayda's key)
  - `index`: integer, 0-based, unique within the file
  - `replicas`: non-empty list of storage addresses

---

## Who does what (division of responsibility)

- **Client (Alberto)** generates `chunk_id`s, splits into 1024-byte chunks,
  uploads each chunk to ≥2 storage servers (picked from `GET /storage`), then
  calls `POST /files`. On read it calls `GET /files/<name>` and pulls chunks.
- **Storage servers (Mayda)** call `POST /storage/register` on startup and
  serve `PUT/GET/DELETE /chunks/{chunk_id}`. The naming server never talks to
  storage servers directly — it only records where the client put things.
- **Naming server (Jhulian)** is the source of truth for metadata only.
