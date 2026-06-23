# Usage Guide (Client CLI)

This guide shows concrete client operations for the distributed file system.

For full environment bring-up, see `SETUP.md`.

## 1) Start the system

```bash
docker compose up --build -d
docker compose ps
```

Wait until naming and storage services are healthy.

## 2) Prepare an input file

```bash
mkdir -p shared
echo "hello distributed world" > shared/report.txt
```

The `shared/` directory is mounted into the client container at `/files`.

## 3) Create (upload + register)

```bash
docker compose run --rm client create /files/report.txt report.txt
```

What it does:

- Splits file into 1024-byte chunks
- Uploads each chunk to at least two storage servers
- Registers metadata in naming server

## 4) Size (metadata-only)

```bash
docker compose run --rm client size report.txt
```

Expected output: a single integer byte count.

## 5) Read

Read to stdout:

```bash
docker compose run --rm client read report.txt
```

Read to file:

```bash
docker compose run --rm client read report.txt /files/out.txt
```

Then verify locally:

```bash
cat shared/out.txt
```

## 6) Delete

```bash
docker compose run --rm client delete report.txt
```

This removes metadata first, then sends best-effort chunk deletes to storage servers.

## 7) End-to-end quick script

```bash
mkdir -p shared
echo "hello" > shared/a.txt
docker compose run --rm client create /files/a.txt a.txt
docker compose run --rm client size a.txt
docker compose run --rm client read a.txt
docker compose run --rm client delete a.txt
```

## 8) Common issues

- `need >= 2 storage servers`: startup race right after `docker compose up`; wait a few seconds and retry.
- `no such file`: file was never created, name mismatch, or it was already deleted.
- Read fails for one storage node: expected behavior is fallback to another replica when available.

## 9) Local (non-Docker) usage

If running services manually, set the naming URL first:

```bash
export NAMING_URL=http://localhost:8000
node client/dfs.ts create ./report.txt
node client/dfs.ts size report.txt
node client/dfs.ts read report.txt out.txt
node client/dfs.ts delete report.txt
```
