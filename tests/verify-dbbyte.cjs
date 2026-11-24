const {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.dbbyte.com',
  credentials: {
    accessKeyId: 'dbs_2579af522a82d0dc1a1a64a6',
    secretAccessKey: 'dbk_4f3768b8293502aa4019225989c91579b5288b6a29d3793a',
  },
  forcePathStyle: true, // often needed for non-AWS S3 endpoints
});

async function verifyDBByte() {
  console.log('======================================================');
  console.log('   DBBYTE S3-COMPATIBILITY & OPERATION VERIFICATION   ');
  console.log('======================================================\n');
  console.log('Endpoint: https://s3.dbbyte.com');
  console.log('AccessKeyId: dbs_2579af522a82d0dc1a1a64a6\n');

  let targetBucket = null;

  // 1. List Buckets
  console.log('1. Testing ListBucketsCommand...');
  try {
    const listRes = await s3.send(new ListBucketsCommand({}));
    console.log('✔ ListBuckets succeeded!');
    console.log('Existing Buckets:', listRes.Buckets?.map(b => b.Name) || 'None found');
    if (listRes.Buckets && listRes.Buckets.length > 0) {
      targetBucket = listRes.Buckets[0].Name;
    }
  } catch (err) {
    console.log('✖ ListBuckets error:', err.message);
  }

  // 2. If no bucket, try creating a test bucket
  if (!targetBucket) {
    const candidateName = 'ss-photography-gallery';
    console.log(`\n2. No buckets found. Attempting to create bucket "${candidateName}"...`);
    try {
      await s3.send(new CreateBucketCommand({ Bucket: candidateName }));
      console.log(`✔ CreateBucket "${candidateName}" succeeded!`);
      targetBucket = candidateName;
    } catch (err) {
      console.log(`✖ CreateBucket error: ${err.message}`);
    }
  } else {
    console.log(`\n2. Using existing bucket: "${targetBucket}"`);
  }

  if (!targetBucket) {
    console.log('\nCannot proceed with object operations without a valid bucket name.');
    return;
  }

  // 3. PutObject
  const testKey = `verification_test_${Date.now()}.txt`;
  console.log(`\n3. Testing PutObjectCommand (uploading "${testKey}")...`);
  try {
    await s3.send(new PutObjectCommand({
      Bucket: targetBucket,
      Key: testKey,
      Body: Buffer.from('SS Photography DBByte verification probe at ' + new Date().toISOString()),
      ContentType: 'text/plain',
    }));
    console.log('✔ PutObject upload succeeded!');
  } catch (err) {
    console.log('✖ PutObject error:', err.message);
    return;
  }

  // 4. HeadObject
  console.log(`\n4. Testing HeadObjectCommand (inspecting metadata)...`);
  try {
    const headRes = await s3.send(new HeadObjectCommand({
      Bucket: targetBucket,
      Key: testKey,
    }));
    console.log('✔ HeadObject succeeded! ContentLength:', headRes.ContentLength, 'ContentType:', headRes.ContentType);
  } catch (err) {
    console.log('✖ HeadObject error:', err.message);
  }

  // 5. GetObject
  console.log(`\n5. Testing GetObjectCommand (reading object)...`);
  try {
    const getRes = await s3.send(new GetObjectCommand({
      Bucket: targetBucket,
      Key: testKey,
    }));
    const chunks = [];
    for await (const chunk of getRes.Body) {
      chunks.push(chunk);
    }
    const bodyStr = Buffer.concat(chunks).toString('utf8');
    console.log('✔ GetObject succeeded! Content:', bodyStr);
  } catch (err) {
    console.log('✖ GetObject error:', err.message);
  }

  // 6. Presigned URL
  console.log(`\n6. Testing Presigned URL generation...`);
  try {
    const getCommand = new GetObjectCommand({ Bucket: targetBucket, Key: testKey });
    const signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 300 });
    console.log('✔ Presigned URL generated successfully!');
    console.log('Sample Signed URL:', signedUrl.substring(0, 80) + '...');
  } catch (err) {
    console.log('✖ Presigned URL error:', err.message);
  }

  // 7. DeleteObject (Clean up)
  console.log(`\n7. Testing DeleteObjectCommand (cleaning up test file)...`);
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: targetBucket,
      Key: testKey,
    }));
    console.log('✔ DeleteObject succeeded! Test probe removed.');
  } catch (err) {
    console.log('✖ DeleteObject error:', err.message);
  }

  console.log('\n======================================================');
  console.log('   VERIFICATION RUN COMPLETE                          ');
  console.log('======================================================');
}

verifyDBByte().catch(console.error);
