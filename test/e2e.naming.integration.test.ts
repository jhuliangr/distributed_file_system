import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createE2eHarness,
  makePatternBuffer,
  type E2eHarness,
} from './helpers/e2e-harness.ts';

let harness: E2eHarness;

before(async () => {
  harness = await createE2eHarness();
});

after(async () => {
  await harness.cleanup();
});

beforeEach(async () => {
  await harness.reset();
});

test('naming: delete removes metadata (GET /files and /size return 404)', async () => {
  const bytes = makePatternBuffer(700);
  const filePath = await harness.writeFixtureFile('naming-delete.bin', bytes);

  await harness.create(filePath, 'naming-delete.bin');
  await harness.remove('naming-delete.bin');

  assert.equal((await harness.getFile('naming-delete.bin')).status, 404);
  assert.equal((await harness.getFileSize('naming-delete.bin')).status, 404);
});

test('naming: size endpoint matches uploaded bytes', async () => {
  const bytes = makePatternBuffer(2049);
  const filePath = await harness.writeFixtureFile('naming-size.bin', bytes);

  await harness.create(filePath, 'naming-size.bin');

  const sizeRes = await harness.getFileSize('naming-size.bin');
  assert.equal(sizeRes.status, 200);
  const body = (await sizeRes.json()) as { name: string; size: number };
  assert.equal(body.name, 'naming-size.bin');
  assert.equal(body.size, bytes.length);
});

test('naming: file metadata preserves chunk ordering and count', async () => {
  const bytes = makePatternBuffer(3584);
  const filePath = await harness.writeFixtureFile('naming-order.bin', bytes);

  await harness.create(filePath, 'naming-order.bin');
  const metadata = await harness.getFileMetadata('naming-order.bin');

  assert.equal(metadata.num_chunks, 4);
  assert.deepEqual(
    metadata.chunks.map((chunk) => chunk.index),
    [0, 1, 2, 3],
  );
});
