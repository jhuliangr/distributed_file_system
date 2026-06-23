import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createContainer, type Container } from '../../src/container.ts';
import { createApp as createNamingApp } from '../../src/interfaces/http/app.ts';
import { ChunkStore } from '../../storage-server/chunk-store.ts';
import { createApp as createStorageApp } from '../../storage-server/app.ts';

interface DfsClient {
  create(filePath: string, name?: string): Promise<void>;
  read(name: string): Promise<Buffer>;
  remove(name: string): Promise<void>;
  size(name: string): Promise<number>;
}

export interface StorageNode {
  server: Server;
  address: string;
  dataDir: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  num_chunks: number;
  chunks: { index: number; chunk_id: string; replicas: string[] }[];
}

export interface E2eHarness {
  namingBaseUrl: string;
  storageNodes: StorageNode[];
  create(filePath: string, name?: string): Promise<void>;
  read(name: string): Promise<Buffer>;
  remove(name: string): Promise<void>;
  size(name: string): Promise<number>;
  reset(): Promise<void>;
  cleanup(): Promise<void>;
  writeFixtureFile(name: string, bytes: Buffer): Promise<string>;
  stopFirstAliveStorageNode(): Promise<StorageNode>;
  getFileMetadata(name: string): Promise<FileMetadata>;
  getFile(name: string): Promise<Response>;
  getFileSize(name: string): Promise<Response>;
  countPhysicalCopies(chunkId: string): Promise<number>;
}

const sendJson = async (
  method: string,
  baseUrl: string,
  endpoint: string,
  body?: unknown,
): Promise<Response> =>
  fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function joinUrl(baseUrl: string, endpoint: string): string {
  return `${baseUrl}${endpoint}`;
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function startStorageNode(workspaceDir: string, index: number): Promise<StorageNode> {
  const dataDir = await mkdtemp(path.join(workspaceDir, `storage-${index}-`));
  const store = new ChunkStore(dataDir);
  await store.init();

  const app = createStorageApp({ store, selfAddress: `node-${index}` });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('expected storage TCP address');
  }

  return {
    server,
    address: `127.0.0.1:${addr.port}`,
    dataDir,
  };
}

async function restartStorageNode(node: StorageNode, index: number): Promise<StorageNode> {
  const store = new ChunkStore(node.dataDir);
  await store.init();
  const app = createStorageApp({ store, selfAddress: `node-${index}` });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('expected storage TCP address');
  }

  return {
    server,
    address: `127.0.0.1:${addr.port}`,
    dataDir: node.dataDir,
  };
}

export function makePatternBuffer(size: number): Buffer {
  const out = Buffer.alloc(size);
  for (let i = 0; i < size; i++) out[i] = i % 251;
  return out;
}

export async function createE2eHarness(): Promise<E2eHarness> {
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'dfs-e2e-'));
  const container: Container = createContainer({ dbPath: ':memory:' });

  const namingServer = createNamingApp(container).listen(0);
  await new Promise((resolve) => namingServer.once('listening', resolve));
  const namingAddress = namingServer.address();
  if (namingAddress === null || typeof namingAddress === 'string') {
    throw new Error('expected naming TCP address');
  }
  const namingBaseUrl = `http://127.0.0.1:${namingAddress.port}`;

  let storageNodes = await Promise.all([1, 2, 3].map((idx) => startStorageNode(workspaceDir, idx)));

  const originalNamingUrl = process.env.NAMING_URL;
  process.env.NAMING_URL = namingBaseUrl;
  const dfs = (await import('../../client/dfs.ts')) as DfsClient;

  const registerAliveStorage = async (): Promise<void> => {
    for (const node of storageNodes) {
      if (!node.server.listening) continue;
      const res = await sendJson('POST', namingBaseUrl, '/storage/register', {
        address: node.address,
      });
      assert.equal(res.status, 200);
    }
  };

  const ensureAllStorageNodesRunning = async (): Promise<void> => {
    for (let i = 0; i < storageNodes.length; i++) {
      const node = storageNodes[i];
      if (node.server.listening) continue;
      storageNodes[i] = await restartStorageNode(node, i + 1);
    }
  };

  return {
    namingBaseUrl,
    get storageNodes() {
      return storageNodes;
    },
    create: (filePath: string, name?: string) => dfs.create(filePath, name),
    read: (name: string) => dfs.read(name),
    remove: (name: string) => dfs.remove(name),
    size: (name: string) => dfs.size(name),
    async reset(): Promise<void> {
      await ensureAllStorageNodesRunning();
      container.connection.exec('DELETE FROM files; DELETE FROM storage_servers;');
      await registerAliveStorage();
    },
    async cleanup(): Promise<void> {
      for (const node of storageNodes) {
        if (node.server.listening) {
          await stopServer(node.server);
        }
        await rm(node.dataDir, { recursive: true, force: true });
      }

      await stopServer(namingServer);
      container.connection.close();
      await rm(workspaceDir, { recursive: true, force: true });

      if (originalNamingUrl === undefined) delete process.env.NAMING_URL;
      else process.env.NAMING_URL = originalNamingUrl;
    },
    async writeFixtureFile(name: string, bytes: Buffer): Promise<string> {
      const filePath = path.join(workspaceDir, name);
      await writeFile(filePath, bytes);
      return filePath;
    },
    async stopFirstAliveStorageNode(): Promise<StorageNode> {
      const node = storageNodes.find((item) => item.server.listening);
      if (!node) throw new Error('expected at least one storage node to be running');
      await stopServer(node.server);
      return node;
    },
    async getFileMetadata(name: string): Promise<FileMetadata> {
      const res = await fetch(joinUrl(namingBaseUrl, `/files/${encodeURIComponent(name)}`));
      assert.equal(res.status, 200);
      return (await res.json()) as FileMetadata;
    },
    getFile: (name: string) =>
      fetch(joinUrl(namingBaseUrl, `/files/${encodeURIComponent(name)}`)),
    getFileSize: (name: string) =>
      fetch(joinUrl(namingBaseUrl, `/files/${encodeURIComponent(name)}/size`)),
    async countPhysicalCopies(chunkId: string): Promise<number> {
      let copies = 0;
      for (const node of storageNodes) {
        if (!node.server.listening) continue;
        const res = await fetch(`http://${node.address}/chunks/${chunkId}`);
        if (res.status === 200) copies++;
      }
      return copies;
    },
  };
}
