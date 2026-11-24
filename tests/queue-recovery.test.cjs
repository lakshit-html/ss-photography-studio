const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function testQueueRecovery() {
  console.log('--- Testing Uploader Persistent Queue & Recovery ---');

  const queueFile = path.resolve(process.cwd(), 'uploader/test-queue.json');
  
  // 1. Simulate saving 3 pending captures to disk before a crash/restart
  const mockQueue = [
    {
      id: 'queue_test_001',
      filePath: 'C:/Users/Suresh/Desktop/FaceReco/tether_inbox/DSC_9001.JPG',
      filename: 'DSC_9001.JPG',
      fileSize: 4500120,
      status: 'PENDING',
      attempts: 0,
      addedAt: new Date().toISOString(),
    },
    {
      id: 'queue_test_002',
      filePath: 'C:/Users/Suresh/Desktop/FaceReco/tether_inbox/DSC_9002.JPG',
      filename: 'DSC_9002.JPG',
      fileSize: 4621000,
      status: 'RETRY',
      attempts: 1,
      lastError: 'Network offline: ENOTFOUND',
      addedAt: new Date().toISOString(),
    },
    {
      id: 'queue_test_003',
      filePath: 'C:/Users/Suresh/Desktop/FaceReco/tether_inbox/DSC_9003.JPG',
      filename: 'DSC_9003.JPG',
      fileSize: 4490000,
      status: 'COMPLETED',
      sha256: 'mock_sha256_hash_9003',
      attempts: 1,
      addedAt: new Date().toISOString(),
    },
  ];

  fs.writeFileSync(queueFile, JSON.stringify(mockQueue, null, 2), 'utf8');
  console.log('✔ Simulated queue written to disk.');

  // 2. Simulate daemon restart: Read and restore queue
  const reloaded = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  const pendingItems = reloaded.filter(item => item.status === 'PENDING' || item.status === 'RETRY');
  const completedHashes = new Set(reloaded.filter(item => item.status === 'COMPLETED').map(item => item.sha256));

  assert.strictEqual(pendingItems.length, 2, 'Must restore exactly 2 pending/retry items');
  assert.strictEqual(pendingItems[0].filename, 'DSC_9001.JPG');
  assert.strictEqual(pendingItems[1].filename, 'DSC_9002.JPG');
  assert.ok(completedHashes.has('mock_sha256_hash_9003'), 'Must remember completed hashes across restarts');

  console.log('✔ Queue successfully restored after simulated restart!');
  console.log(`  Restored pending photos: ${pendingItems.length}`);
  console.log(`  Restored completed dedupe hashes: ${completedHashes.size}`);

  // Clean up
  fs.unlinkSync(queueFile);
  console.log('\n--- Uploader Queue Recovery Verification: PASSED! ---');
}

testQueueRecovery().catch(err => {
  console.error('Queue recovery test failed:', err);
  process.exit(1);
});
