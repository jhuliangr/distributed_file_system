import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { CHUNK_SIZE, chunkBuffer, pickReplicas } from '../client/dfs.ts';

test('chunkBuffer splits into 1024-byte pieces and reassembles identically', () => {
  for (const len of [0, 1, 1023, 1024, 1025, 4096, 5000]) {
    const buf = randomBytes(len);
    const parts = chunkBuffer(buf);

    assert.equal(parts.length, Math.ceil(len / CHUNK_SIZE));
    for (let i = 0; i < parts.length - 1; i++) assert.equal(parts[i].length, CHUNK_SIZE);
    if (parts.length) assert.ok(parts.at(-1)!.length <= CHUNK_SIZE);

    assert.deepEqual(Buffer.concat(parts), buf);
  }
});

test('pickReplicas picks 2 distinct servers, round-robin across chunks', () => {
  const servers = ['s1:1', 's2:2', 's3:3'];
  assert.deepEqual(pickReplicas(servers, 0), ['s1:1', 's2:2']);
  assert.deepEqual(pickReplicas(servers, 1), ['s2:2', 's3:3']);
  assert.deepEqual(pickReplicas(servers, 2), ['s3:3', 's1:1']);
  for (let i = 0; i < 10; i++) {
    const r = pickReplicas(servers, i);
    assert.equal(new Set(r).size, 2);
  }
});
