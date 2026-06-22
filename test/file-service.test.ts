import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FileService } from '../src/application/file-service.ts';
import {
  FileAlreadyExistsError,
  FileNotFoundError,
} from '../src/domain/errors.ts';
import type { StoredFile } from '../src/domain/entities.ts';
import type { FileRepository } from '../src/domain/ports/file-repository.ts';
import type { Clock } from '../src/domain/ports/clock.ts';

class InMemoryFileRepository implements FileRepository {
  private readonly store = new Map<string, StoredFile>();

  async exists(name: string): Promise<boolean> {
    return this.store.has(name);
  }
  async save(file: StoredFile): Promise<void> {
    this.store.set(file.name, file);
  }
  async findByName(name: string): Promise<StoredFile | null> {
    return this.store.get(name) ?? null;
  }
  async getSize(name: string): Promise<number | null> {
    return this.store.get(name)?.size ?? null;
  }
  async delete(name: string): Promise<StoredFile | null> {
    const existing = this.store.get(name) ?? null;
    this.store.delete(name);
    return existing;
  }
}

const fixedClock: Clock = { now: () => '2026-01-01T00:00:00.000Z' };

function makeService(): FileService {
  return new FileService(new InMemoryFileRepository(), fixedClock);
}

const command = {
  name: 'a.txt',
  size: 5,
  chunks: [{ index: 0, chunkId: 'c0', replicas: ['s1', 's2'] }],
};

test('createFile stamps createdAt from the injected clock', async () => {
  const service = makeService();
  const file = await service.createFile(command);
  assert.equal(file.createdAt, '2026-01-01T00:00:00.000Z');
});

test('createFile rejects a duplicate name', async () => {
  const service = makeService();
  await service.createFile(command);
  await assert.rejects(
    () => service.createFile(command),
    FileAlreadyExistsError,
  );
});

test('getFile / getSize / deleteFile throw FileNotFoundError when absent', async () => {
  const service = makeService();
  await assert.rejects(() => service.getFile('missing'), FileNotFoundError);
  await assert.rejects(() => service.getSize('missing'), FileNotFoundError);
  await assert.rejects(() => service.deleteFile('missing'), FileNotFoundError);
});

test('deleteFile returns the file it removed', async () => {
  const service = makeService();
  await service.createFile(command);
  const deleted = await service.deleteFile('a.txt');
  assert.equal(deleted.name, 'a.txt');
  await assert.rejects(() => service.getFile('a.txt'), FileNotFoundError);
});
