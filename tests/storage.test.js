import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { computeSHA256 } from '../src/lib/storage.ts';

test('Storage: computeSHA256 generates consistent SHA256 hashes for deduplication', () => {
  const buffer1 = Buffer.from('Nikon D750 Frame Data 1');
  const buffer2 = Buffer.from('Nikon D750 Frame Data 1');
  const buffer3 = Buffer.from('Nikon D750 Frame Data 2');

  const hash1 = computeSHA256(buffer1);
  const hash2 = computeSHA256(buffer2);
  const hash3 = computeSHA256(buffer3);

  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hash3);
  assert.strictEqual(hash1.length, 64);
});
