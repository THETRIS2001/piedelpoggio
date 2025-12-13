import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const R2_ACCESS_KEY_ID = envConfig.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = envConfig.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = envConfig.R2_ENDPOINT;
const BUCKET_NAME = 'piedelpoggio-media';

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function debugMeta() {
  console.log('Listing folders with Delimiter: "/"...');
  const listCmd = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: 'media/',
    Delimiter: '/'
  });
  
  try {
    const result = await client.send(listCmd);
    const folders = (result.CommonPrefixes || []).map(p => p.Prefix);
    
    console.log(`Found ${folders.length} folders.`);
    folders.forEach(f => console.log(` - ${f}`));

    if (result.IsTruncated) {
        console.log('WARNING: Result is truncated! (Should not happen for 43 folders)');
    }
  } catch (err) {
    console.error('List error:', err);
  }
}

debugMeta();
