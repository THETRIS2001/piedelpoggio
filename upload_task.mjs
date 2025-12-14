import { S3Client, ListBucketsCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error('Missing R2 credentials in .env');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const mimeMap = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain'
};

async function getBucketName() {
  const { Buckets } = await client.send(new ListBucketsCommand({}));
  console.log('Buckets found:', Buckets.map(b => b.Name).join(', '));
  // Prefer a bucket named 'media' or similar if multiple
  const mediaBucket = Buckets.find(b => b.Name.includes('media') || b.Name.includes('pdp') || b.Name.includes('site'));
  return mediaBucket ? mediaBucket.Name : Buckets[0].Name;
}

async function uploadFolder(localPath, remotePrefix, bucketName) {
  console.log(`Scanning: ${localPath}`);
  const entries = await fs.readdir(localPath, { withFileTypes: true });
  console.log(`Found ${entries.length} entries in ${localPath}`);
  let count = 0;
  for (const entry of entries) {
    count++;
    if (count % 50 === 0) console.log(`Processing ${count}/${entries.length} in ${path.basename(localPath)}`);
    const fullPath = path.join(localPath, entry.name);
    const remoteKey = path.posix.join(remotePrefix, entry.name);

    if (entry.isDirectory()) {
      await uploadFolder(fullPath, remoteKey, bucketName);
    } else {
      if (entry.name === '.DS_Store') continue;

      // Check if exists
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: remoteKey }));
        // console.log(`Skipping (exists): ${remoteKey}`);
      } catch (e) {
        if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
          console.log(`Uploading: ${remoteKey}`);
          const content = await fs.readFile(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          const contentType = mimeMap[ext] || 'application/octet-stream';
          
          await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: remoteKey,
            Body: content,
            ContentType: contentType
          }));
        } else {
          console.error(`Error checking ${remoteKey}:`, e);
        }
      }
    }
  }
}

async function main() {
  const bucketName = await getBucketName();
  console.log(`Using bucket: ${bucketName}`);
  
  const sourceDir = path.resolve('FOTO SITO');
  console.log(`Source: ${sourceDir}`);
  
  // Verify source exists
  try {
    await fs.access(sourceDir);
  } catch {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Upload to 'media/' prefix as per the app structure
  await uploadFolder(sourceDir, 'media', bucketName);
  console.log('Done!');
}

main().catch(console.error);
