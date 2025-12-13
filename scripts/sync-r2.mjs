import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env manually
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = await fs.readFile(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  });
} catch (e) {
  console.log('Could not load .env file, relying on process.env');
}

const R2_ENDPOINT = process.env.R2_ENDPOINT || 'https://2fc1f6539283b9d79329d9e2d6fc9281.r2.cloudflarestorage.com';
const BUCKET_NAME = 'piedelpoggio-media';
const SOURCE_DIR = path.join(__dirname, '..', 'FOTO SITO');

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error('Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set.');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.ogg': return 'video/ogg';
    case '.txt': return 'text/plain';
    case '.json': return 'application/json';
    default: return 'application/octet-stream';
  }
}

async function emptyBucket() {
  console.log('Listing objects to delete...');
  let continuationToken;
  let deletedCount = 0;
  do {
    const listCmd = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
    });
    const result = await client.send(listCmd);
    
    if (result.Contents && result.Contents.length > 0) {
      const objectsToDelete = result.Contents.map(o => ({ Key: o.Key }));
      console.log(`Deleting ${objectsToDelete.length} objects...`);
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: objectsToDelete },
      });
      await client.send(deleteCmd);
      deletedCount += objectsToDelete.length;
    }
    
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);
  console.log(`Bucket emptied. Total deleted: ${deletedCount}`);
}

async function uploadDirectory(dir, baseDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await uploadDirectory(fullPath, baseDir);
    } else if (entry.isFile()) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const key = `media/${relativePath}`; // Prepend media/ to match API expectation
      const fileContent = await fs.readFile(fullPath);
      const contentType = getContentType(entry.name);
      
      console.log(`Uploading ${key}...`);
      try {
        const putCmd = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: fileContent,
          ContentType: contentType,
        });
        await client.send(putCmd);
      } catch (err) {
        console.error(`Failed to upload ${relativePath}:`, err);
      }
    }
  }
}

async function main() {
  try {
    console.log(`Starting sync from ${SOURCE_DIR} to ${BUCKET_NAME}`);
    await emptyBucket();
    console.log(`Uploading files...`);
    await uploadDirectory(SOURCE_DIR, SOURCE_DIR);
    console.log('Upload complete.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
