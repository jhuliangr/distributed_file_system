// Demo web UI for the distributed file system.
//
// A thin HTTP wrapper around the existing client (client/dfs.ts) so a browser
// can drive create/read/delete/size and watch chunk replication live. Runs on
// the `dfs` docker network because it must reach the storage servers directly
// (the browser cannot — they are not published to the host).
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { create, read, remove, size } from '../client/dfs.ts';

const NAMING_URL = (process.env.NAMING_URL ?? 'http://naming-server:8000').replace(/\/$/, '');
const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(here));

// Wrap an async handler so thrown errors become a 400 with the message — the
// client functions throw plain Errors with useful text (e.g. "file exists").
const h =
  (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
  (req: express.Request, res: express.Response) =>
    fn(req, res).catch((e) => res.status(400).json({ error: (e as Error).message }));

// Storage-server registry, dead ones included so the demo can show liveness.
app.get('/api/storage', h(async (_req, res) => {
  const r = await fetch(`${NAMING_URL}/storage?all=1`);
  res.status(r.status).json(await r.json());
}));

// Chunk placement metadata — the interesting part to visualise.
app.get('/api/files/:name', h(async (req, res) => {
  const r = await fetch(`${NAMING_URL}/files/${encodeURIComponent(req.params.name)}`);
  res.status(r.status).json(await r.json());
}));

app.post('/api/files', h(async (req, res) => {
  const { name, content } = req.body as { name?: string; content?: string };
  if (!name || content == null) throw new Error('name and content are required');
  const tmp = join(tmpdir(), randomUUID());
  await writeFile(tmp, content);
  try {
    await create(tmp, name);
  } finally {
    await unlink(tmp).catch(() => {});
  }
  res.json({ status: 'created', name, size: Buffer.byteLength(content) });
}));

app.get('/api/files/:name/content', h(async (req, res) => {
  res.type('text/plain').send(await read(req.params.name));
}));

app.get('/api/files/:name/size', h(async (req, res) => {
  res.json({ name: req.params.name, size: await size(req.params.name) });
}));

app.delete('/api/files/:name', h(async (req, res) => {
  await remove(req.params.name);
  res.json({ status: 'deleted', name: req.params.name });
}));

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => console.log(`dfs demo UI on http://localhost:${PORT}`));
