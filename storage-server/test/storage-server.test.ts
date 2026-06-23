import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { ChunkStore } from '../chunk-store.ts';
import { createApp } from '../app.ts';

let server: Server;
let baseUrl: string;
let dataDir: string;

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
  const store = new ChunkStore(dataDir);
  await store.init();
  const app = createApp({ store, selfAddress: 'test:0' });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('PUT then GET returns the same bytes', async () => {
  const body = Buffer.from('hello chunk');
  const put = await fetch(`${baseUrl}/chunks/abc123`, { method: 'PUT', body });
  assert.equal(put.status, 201);
  assert.equal((await put.json()).size, body.length);

  const get = await fetch(`${baseUrl}/chunks/abc123`);
  assert.equal(get.status, 200);
  assert.equal(Buffer.from(await get.arrayBuffer()).toString(), 'hello chunk');
});

test('GET on a missing chunk returns 404', async () => {
  const res = await fetch(`${baseUrl}/chunks/does-not-exist`);
  assert.equal(res.status, 404);
});

test('DELETE removes the chunk and is idempotent', async () => {
  await fetch(`${baseUrl}/chunks/todelete`, { method: 'PUT', body: Buffer.from('x') });

  const first = await fetch(`${baseUrl}/chunks/todelete`, { method: 'DELETE' });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).existed, true);

  const afterDelete = await fetch(`${baseUrl}/chunks/todelete`);
  assert.equal(afterDelete.status, 404);

  const second = await fetch(`${baseUrl}/chunks/todelete`, { method: 'DELETE' });
  assert.equal(second.status, 200);
  assert.equal((await second.json()).existed, false);
});

test('an unsafe chunk_id is rejected with 400', async () => {
  // express normalizes paths, so test the rejection via a traversal-style id
  const res = await fetch(`${baseUrl}/chunks/..%2Fescape`, { method: 'PUT', body: Buffer.from('x') });
  assert.equal(res.status, 400);
});
