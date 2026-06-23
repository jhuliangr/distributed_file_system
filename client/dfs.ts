import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

export const CHUNK_SIZE = 1024;
const REPLICAS = 2;

const NAMING_URL = (process.env.NAMING_URL ?? 'http://naming-server:8000').replace(/\/$/, '');

interface Replica {
  chunk_id: string;
  index: number;
  replicas: string[];
}

export function chunkBuffer(buf: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  for (let off = 0; off < buf.length; off += CHUNK_SIZE) {
    chunks.push(buf.subarray(off, off + CHUNK_SIZE));
  }
  return chunks;
}

export function pickReplicas(servers: string[], index: number, n = REPLICAS): string[] {
  const out: string[] = [];
  for (let k = 0; k < n; k++) out.push(servers[(index + k) % servers.length]);
  return out;
}

async function naming(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${NAMING_URL}${path}`, init);
}

async function aliveServers(): Promise<string[]> {
  const res = await naming('/storage');
  if (!res.ok) throw new Error(`naming GET /storage failed: ${res.status}`);
  const body = (await res.json()) as { servers: { address: string }[] };
  return body.servers.map((s) => s.address);
}

async function reportStatus(address: string, alive: boolean): Promise<void> {
  await naming(`/storage/${address}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ alive }),
  }).catch(() => {});
}

const chunkUrl = (address: string, id: string) => `http://${address}/chunks/${id}`;

async function putChunk(address: string, id: string, bytes: Buffer): Promise<boolean> {
  try {
    const res = await fetch(chunkUrl(address, id), { method: 'PUT', body: bytes });
    return res.ok;
  } catch {
    return false;
  }
}

async function getChunk(address: string, id: string): Promise<Buffer | null> {
  try {
    const res = await fetch(chunkUrl(address, id));
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function create(filePath: string, name = basename(filePath)): Promise<void> {
  const buf = await readFile(filePath);
  const parts = chunkBuffer(buf);
  if (parts.length === 0) throw new Error('cannot store an empty file');

  const servers = await aliveServers();
  if (servers.length < REPLICAS) {
    throw new Error(`need >= ${REPLICAS} storage servers, found ${servers.length}`);
  }

  const meta: Replica[] = [];
  for (let index = 0; index < parts.length; index++) {
    const chunk_id = randomUUID();
    const bytes = parts[index];

    const candidates = [...pickReplicas(servers, index), ...servers];
    const stored: string[] = [];
    for (const address of candidates) {
      if (stored.includes(address)) continue;
      if (await putChunk(address, chunk_id, bytes)) stored.push(address);
      else await reportStatus(address, false);
      if (stored.length === REPLICAS) break;
    }
    if (stored.length < REPLICAS) {
      throw new Error(`chunk ${index}: only ${stored.length}/${REPLICAS} replicas stored`);
    }
    meta.push({ chunk_id, index, replicas: stored });
  }

  const res = await naming('/files', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, size: buf.length, chunks: meta }),
  });
  if (res.status === 409) throw new Error(`file already exists: ${name}`);
  if (!res.ok) throw new Error(`naming POST /files failed: ${res.status} ${await res.text()}`);
}

export async function read(name: string): Promise<Buffer> {
  const res = await naming(`/files/${encodeURIComponent(name)}`);
  if (res.status === 404) throw new Error(`no such file: ${name}`);
  if (!res.ok) throw new Error(`naming GET /files failed: ${res.status}`);
  const file = (await res.json()) as { chunks: Replica[] };

  const ordered = [...file.chunks].sort((a, b) => a.index - b.index);
  const buffers: Buffer[] = [];
  for (const chunk of ordered) {
    let bytes: Buffer | null = null;
    for (const address of chunk.replicas) {
      bytes = await getChunk(address, chunk.chunk_id);
      if (bytes) break;
      await reportStatus(address, false);
    }
    if (!bytes) throw new Error(`chunk ${chunk.index}: all replicas unreachable`);
    buffers.push(bytes);
  }
  return Buffer.concat(buffers);
}

export async function remove(name: string): Promise<void> {
  const res = await naming(`/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (res.status === 404) throw new Error(`no such file: ${name}`);
  if (!res.ok) throw new Error(`naming DELETE /files failed: ${res.status}`);
  const file = (await res.json()) as { chunks: Replica[] };

  await Promise.all(
    file.chunks.flatMap((c) =>
      c.replicas.map((address) =>
        fetch(chunkUrl(address, c.chunk_id), { method: 'DELETE' }).catch(() => {}),
      ),
    ),
  );
}

export async function size(name: string): Promise<number> {
  const res = await naming(`/files/${encodeURIComponent(name)}/size`);
  if (res.status === 404) throw new Error(`no such file: ${name}`);
  if (!res.ok) throw new Error(`naming GET size failed: ${res.status}`);
  const body = (await res.json()) as { size: number };
  return body.size;
}

const USAGE = `dfs — distributed file system client (NAMING_URL=${NAMING_URL})

  node client/dfs.ts create <path> [name]   split, replicate, register
  node client/dfs.ts read   <name> [out]    reassemble (stdout, or to <out>)
  node client/dfs.ts delete <name>          remove metadata + chunks
  node client/dfs.ts size   <name>          file size in bytes`;

async function main(argv: string[]): Promise<void> {
  const [cmd, a, b] = argv;
  switch (cmd) {
    case 'create':
      if (!a) throw new Error('usage: create <path> [name]');
      await create(a, b);
      console.log(`created ${b ?? basename(a)}`);
      break;
    case 'read': {
      if (!a) throw new Error('usage: read <name> [out]');
      const data = await read(a);
      if (b) {
        await writeFile(b, data);
        console.log(`wrote ${data.length} bytes to ${b}`);
      } else {
        process.stdout.write(data);
      }
      break;
    }
    case 'delete':
      if (!a) throw new Error('usage: delete <name>');
      await remove(a);
      console.log(`deleted ${a}`);
      break;
    case 'size':
      if (!a) throw new Error('usage: size <name>');
      console.log(await size(a));
      break;
    default:
      console.log(USAGE);
      process.exitCode = cmd ? 1 : 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  });
}
