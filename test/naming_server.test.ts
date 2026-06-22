import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createContainer, type Container } from '../src/container.ts';
import { createApp } from '../src/interfaces/http/app.ts';

let server: Server;
let base: string;
let container: Container;

function sampleFile() {
  return {
    name: 'report.txt',
    size: 2048,
    chunks: [
      {
        chunk_id: 'ab12',
        index: 0,
        replicas: ['storage1:8001', 'storage2:8002'],
      },
      {
        chunk_id: 'cd34',
        index: 1,
        replicas: ['storage2:8002', 'storage3:8003'],
      },
    ],
  };
}

const get = (path: string): Promise<Response> => fetch(`${base}${path}`);
const send = (
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

before(async () => {
  container = createContainer({ dbPath: ':memory:' });
  server = createApp(container).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const addr = server.address();
  if (addr === null || typeof addr === 'string')
    throw new Error('expected a TCP address');
  base = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  server.close();
  container.connection.close();
});

beforeEach(() => {
  container.connection.exec('DELETE FROM files; DELETE FROM storage_servers');
});

// ===========================================================================
// health & storage registry
// ===========================================================================

test('health', async () => {
  const body = (await (await get('/health')).json()) as { status: string };
  assert.equal(body.status, 'ok');
});

test('register and list storage', async () => {
  await send('POST', '/storage/register', { address: 'storage1:8001' });
  await send('POST', '/storage/register', { address: 'storage2:8002' });
  const { servers } = (await (await get('/storage')).json()) as {
    servers: { address: string; alive: number; last_seen: string }[];
  };
  assert.deepEqual(
    new Set(servers.map((s) => s.address)),
    new Set(['storage1:8001', 'storage2:8002']),
  );
  assert.equal(servers[0].alive, 1);
});

test('register storage requires address', async () => {
  assert.equal((await send('POST', '/storage/register', {})).status, 400);
});

test('register is idempotent', async () => {
  await send('POST', '/storage/register', { address: 'storage1:8001' });
  await send('POST', '/storage/register', { address: 'storage1:8001' });
  const { servers } = (await (await get('/storage')).json()) as {
    servers: unknown[];
  };
  assert.equal(servers.length, 1);
});

test('marking storage dead hides it (but ?all=1 shows it)', async () => {
  await send('POST', '/storage/register', { address: 'storage1:8001' });
  await send('POST', '/storage/storage1:8001/status', { alive: false });
  const alive = (await (await get('/storage')).json()) as {
    servers: unknown[];
  };
  const all = (await (await get('/storage?all=1')).json()) as {
    servers: unknown[];
  };
  assert.equal(alive.servers.length, 0);
  assert.equal(all.servers.length, 1);
});

// ===========================================================================
// file lifecycle
// ===========================================================================

test('create file', async () => {
  const res = await send('POST', '/files', sampleFile());
  assert.equal(res.status, 201);
  assert.equal(((await res.json()) as { num_chunks: number }).num_chunks, 2);
});

test('create duplicate conflicts', async () => {
  await send('POST', '/files', sampleFile());
  assert.equal((await send('POST', '/files', sampleFile())).status, 409);
});

test('get file returns ordered chunks with replicas', async () => {
  await send('POST', '/files', sampleFile());
  const data = (await (await get('/files/report.txt')).json()) as {
    size: number;
    num_chunks: number;
    chunks: { index: number; chunk_id: string; replicas: string[] }[];
  };
  assert.equal(data.size, 2048);
  assert.equal(data.num_chunks, 2);
  assert.deepEqual(
    data.chunks.map((c) => c.index),
    [0, 1],
  );
  assert.equal(data.chunks[0].chunk_id, 'ab12');
  assert.deepEqual(data.chunks[0].replicas, ['storage1:8001', 'storage2:8002']);
});

test('get missing file 404', async () => {
  assert.equal((await get('/files/nope.txt')).status, 404);
});

test('size endpoint', async () => {
  await send('POST', '/files', sampleFile());
  const sized = (await (await get('/files/report.txt/size')).json()) as {
    size: number;
  };
  assert.equal(sized.size, 2048);
  assert.equal((await get('/files/nope.txt/size')).status, 404);
});

test('delete returns chunk map and removes file', async () => {
  await send('POST', '/files', sampleFile());
  const res = await send('DELETE', '/files/report.txt');
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { chunks: unknown[] }).chunks.length, 2);
  assert.equal((await get('/files/report.txt')).status, 404);
  assert.equal((await send('DELETE', '/files/report.txt')).status, 404);
});

// ===========================================================================
// validation
// ===========================================================================

const badPayloads: unknown[] = [
  {},
  {
    name: 'x',
    size: -1,
    chunks: [{ chunk_id: 'a', index: 0, replicas: ['s1'] }],
  },
  { name: 'x', size: 10, chunks: [] },
  { name: 'x', size: 10, chunks: [{ index: 0, replicas: ['s1'] }] },
  { name: 'x', size: 10, chunks: [{ chunk_id: 'a', index: 0, replicas: [] }] },
  {
    name: 'x',
    size: 10,
    chunks: [
      { chunk_id: 'a', index: 0, replicas: ['s1'] },
      { chunk_id: 'b', index: 0, replicas: ['s2'] },
    ],
  },
];

test('create validation rejects bad payloads', async () => {
  for (const payload of badPayloads) {
    assert.equal(
      (await send('POST', '/files', payload)).status,
      400,
      JSON.stringify(payload),
    );
  }
});
