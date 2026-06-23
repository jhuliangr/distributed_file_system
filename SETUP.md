# SETUP — Docker & Infrastructure (Nikita)

How to build, run, and use the distributed file system in containers, plus the
**network contract** every service's code must follow.

The stack is **Node 24 + TypeScript run directly via Node's built-in type
stripping** (no build step) + **Express**. SQLite is Node's built-in
`node:sqlite`; the client has no npm dependencies at all.

---

## 1. Bring the system up

```bash
docker compose up --build -d        # builds images, starts naming + 3 storage servers
docker compose ps                   # all should be "healthy"
docker compose logs -f naming-server
```

This starts:

| Service        | Image         | Internal address  | Host port  | Volume (/data)   |
| -------------- | ------------- | ----------------- | ---------- | ---------------- |
| naming-server  | `dfs-naming`  | `naming-server:8000` | `8000`  | `naming-data`    |
| storage-1      | `dfs-storage` | `storage-1:8001`  | —          | `storage-1-data` |
| storage-2      | `dfs-storage` | `storage-2:8001`  | —          | `storage-2-data` |
| storage-3      | `dfs-storage` | `storage-3:8001`  | —          | `storage-3-data` |

All three storage servers reuse **one image** (`dfs-storage`, built once) and
differ only by `SELF_ADDRESS` and their own named volume. They **self-register**
with the naming server on startup and re-announce every `HEARTBEAT_SECONDS`.

The `client` is a CLI, not a daemon — it is in the `client` Compose profile, so
`docker compose up` deliberately does **not** start it. Run it on demand (§3).

Tear down:

```bash
docker compose down            # stop + remove containers/network (keeps volumes)
docker compose down -v         # also delete the data volumes (fresh start)
```

---

## 2. The network contract (what teammates' code must use)

All services share the user-defined bridge network `dfs` and resolve each other
by **service name**. Addresses are `host:port` reachable on that network.

| From → To                | Address / URL                  | Env var (service)                 |
| ------------------------ | ------------------------------ | --------------------------------- |
| anyone → naming server   | `http://naming-server:8000`    | `NAMING_SERVER_URL` (storage) / `NAMING_URL` (client) |
| client/others → storage  | `storage-1:8001` … `storage-3:8001` | reported by each storage as `SELF_ADDRESS` |

Env vars each service reads (defaults baked into the images; overridden in
`docker-compose.yml` where needed):

**Naming server** — `src/server.ts`, listens on `0.0.0.0:8000`
- `PORT` (default `8000`)
- `NAMING_DB_PATH` (default `/data/naming.db`) — on the `naming-data` volume

**Storage server** — `storage-server/server.ts`, listens on `0.0.0.0:8001`
- `PORT` (default `8001`)
- `DATA_DIR` (default `/data`) — chunk files, on a per-instance volume
- `SELF_ADDRESS` — **must equal `<service-name>:8001`** (e.g. `storage-2:8001`).
  This is the address the storage server registers and that the client uses to
  fetch chunks, so it must be the Docker-resolvable name, not `localhost`.
- `NAMING_SERVER_URL` (default `http://naming-server:8000`)
- `HEARTBEAT_SECONDS` (default `15`)

**Client** — `client/dfs.ts`, CLI (`create` / `read` / `delete` / `size`)
- `NAMING_URL` (default `http://naming-server:8000`) — ⚠️ note the name is
  `NAMING_URL`, **not** `NAMING_SERVER_URL` like the storage servers use.

> **Contract rules for the team:** servers must bind `0.0.0.0` (not
> `127.0.0.1`) so they're reachable across containers; storage `SELF_ADDRESS`
> must be the compose service name + `8001`; nothing may hardcode `localhost` or
> a host IP — read the env vars above. If you add/rename a storage service,
> match its `SELF_ADDRESS` and give it its own named volume.

---

## 3. Running client commands (a CLI that exits)

The client image's `ENTRYPOINT` is `node client/dfs.ts`, so arguments passed to
the container are the CLI command. Put files you want to upload in `./shared/`
(bind-mounted to `/files` in the container); `read … /files/out.txt` writes back
there too.

```bash
mkdir -p shared
echo "hello distributed world" > shared/report.txt
```

### Approach A — one-off `docker compose run` (recommended)

Each command is a fresh container that runs and exits (`--rm` cleans it up):

```bash
docker compose run --rm client create /files/report.txt report.txt
docker compose run --rm client size   report.txt
docker compose run --rm client read   report.txt /files/out.txt   # -> shared/out.txt
docker compose run --rm client read   report.txt                  # -> stdout
docker compose run --rm client delete report.txt
```

`run` inherits the service's `NAMING_URL`, network, volume, and `depends_on`
(so it waits for naming + storage to be healthy before starting).

### Approach B — one idle container + `docker exec`

Start a long-lived client container once, then exec commands into it (handy for
a quick interactive loop):

```bash
# Start an idle client (override the entrypoint so it just sleeps):
docker compose run -d --name dfs-client --entrypoint sleep client infinity

docker exec dfs-client node client/dfs.ts create /files/report.txt report.txt
docker exec dfs-client node client/dfs.ts size   report.txt
docker exec dfs-client node client/dfs.ts read   report.txt /files/out.txt

# Or an interactive shell:
docker exec -it dfs-client sh

# When done:
docker rm -f dfs-client
```

---

## 4. Startup ordering & where retries are still needed

`depends_on` with `condition: service_healthy` (backed by the health checks in
`docker-compose.yml`) makes dependents wait until a service is actually
**ready**, not merely started. Plain `depends_on` would only wait for the
container to start — that's the classic gap, which the health checks close here.

Remaining places that still rely on application-level retry, not Compose:

- **Storage → naming registration.** A storage server may finish starting and
  try to register before the naming server accepts requests. This is already
  handled: `storage-server/registration.ts` catches failures (never crashes)
  and re-registers every `HEARTBEAT_SECONDS`, so it self-heals. The
  `service_healthy` dependency makes the very first attempt usually succeed.
- **Client has no retry.** `client/dfs.ts` makes a single attempt per call. Its
  `depends_on` (naming + all three storage healthy) covers the normal case, but
  note `create` needs **≥2 storage servers already registered** with the naming
  server. Health = process up; registration is a moment later. If a `create`
  right after `up` reports *"need >= 2 storage servers"*, wait a few seconds
  (one heartbeat) and retry — that registration delay is the only race left.

---

## 5. Quick smoke test

```bash
docker compose up --build -d
curl -s localhost:8000/health                       # {"status":"ok","service":"naming-server"}
curl -s localhost:8000/storage | jq                 # 3 registered, alive servers

mkdir -p shared && echo "hello" > shared/a.txt
docker compose run --rm client create /files/a.txt a.txt
docker compose run --rm client size a.txt           # 6
docker compose run --rm client read a.txt           # hello
docker compose run --rm client delete a.txt
```
