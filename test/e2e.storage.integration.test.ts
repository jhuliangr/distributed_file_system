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

test('storage: each chunk is replicated to at least two nodes', async () => {
  const bytes = makePatternBuffer(3584);
  const filePath = await harness.writeFixtureFile('replication-check.bin', bytes);
  await harness.create(filePath, 'replication-check.bin');

  const metadata = await harness.getFileMetadata('replication-check.bin');

  for (const chunk of metadata.chunks) {
    assert.ok(chunk.replicas.length >= 2, `chunk ${chunk.index} has <2 replicas in metadata`);

    const existingCopies = await harness.countPhysicalCopies(chunk.chunk_id);
    assert.ok(existingCopies >= 2, `chunk ${chunk.index} has ${existingCopies} physical copies`);
  }
});

test('storage: failover read succeeds after one node is down', async () => {
  const bytes = makePatternBuffer(4097);
  const filePath = await harness.writeFixtureFile('storage-failover.bin', bytes);
  await harness.create(filePath, 'storage-failover.bin');

  await harness.stopFirstAliveStorageNode();
  const reassembled = await harness.read('storage-failover.bin');

  assert.deepEqual(reassembled, bytes);
});
