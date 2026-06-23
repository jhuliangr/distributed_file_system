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

test('client: prepare test data fixtures (<1KB, exactly 1KB, several KB)', async () => {
  const tiny = makePatternBuffer(513);
  const exact = makePatternBuffer(1024);
  const large = makePatternBuffer(3584);

  const tinyPath = await harness.writeFixtureFile('fixture-tiny.bin', tiny);
  const exactPath = await harness.writeFixtureFile('fixture-1kb.bin', exact);
  const largePath = await harness.writeFixtureFile('fixture-large.bin', large);

  await harness.create(tinyPath, 'fixture-tiny.bin');
  await harness.create(exactPath, 'fixture-1kb.bin');
  await harness.create(largePath, 'fixture-large.bin');

  assert.equal((await harness.read('fixture-tiny.bin')).length, 513);
  assert.equal((await harness.read('fixture-1kb.bin')).length, 1024);
  assert.equal((await harness.read('fixture-large.bin')).length, 3584);
});

test('client: create -> read returns identical content', async () => {
  const bytes = makePatternBuffer(777);
  const filePath = await harness.writeFixtureFile('roundtrip-small.bin', bytes);

  await harness.create(filePath, 'roundtrip-small.bin');
  const reassembled = await harness.read('roundtrip-small.bin');

  assert.deepEqual(reassembled, bytes);
});

test('client: create -> delete removes file', async () => {
  const bytes = makePatternBuffer(900);
  const filePath = await harness.writeFixtureFile('to-delete.bin', bytes);

  await harness.create(filePath, 'to-delete.bin');
  await harness.remove('to-delete.bin');

  await assert.rejects(() => harness.read('to-delete.bin'), /no such file/);
  await assert.rejects(() => harness.size('to-delete.bin'), /no such file/);
});

test('client: create -> size returns exact value', async () => {
  const bytes = makePatternBuffer(1024);
  const filePath = await harness.writeFixtureFile('size-1kb.bin', bytes);

  await harness.create(filePath, 'size-1kb.bin');
  assert.equal(await harness.size('size-1kb.bin'), 1024);
});

test('client: file >1KB reassembles correctly across multiple chunks', async () => {
  const bytes = makePatternBuffer(3584);
  const filePath = await harness.writeFixtureFile('multichunk.bin', bytes);

  await harness.create(filePath, 'multichunk.bin');
  const reassembled = await harness.read('multichunk.bin');

  assert.equal(reassembled.length, bytes.length);
  assert.deepEqual(reassembled, bytes);
});

test('client: read still works when one storage server is down', async () => {
  const bytes = makePatternBuffer(3584);
  const filePath = await harness.writeFixtureFile('failover.bin', bytes);

  await harness.create(filePath, 'failover.bin');
  await harness.stopFirstAliveStorageNode();

  const reassembled = await harness.read('failover.bin');
  assert.deepEqual(reassembled, bytes);
});
