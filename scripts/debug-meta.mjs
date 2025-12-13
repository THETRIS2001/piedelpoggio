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
  console.log('Listing folders...');
  const listCmd = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: 'media/',
    Delimiter: '/'
  });
  
  try {
    const result = await client.send(listCmd);
    const folders = (result.CommonPrefixes || []).map(p => p.Prefix).slice(0, 5); // Check first 5 folders
    
    console.log(`Found ${result.CommonPrefixes?.length || 0} folders. Checking first 5...`);
    
    for (const folderPrefix of folders) {
      const metaKey = `${folderPrefix}meta.txt`;
      console.log(`\nChecking ${metaKey}...`);
      
      try {
        const getCmd = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: metaKey
        });
        const response = await client.send(getCmd);
        const str = await response.Body.transformToString();
        console.log('--- CONTENT START ---');
        console.log(str);
        console.log('--- CONTENT END ---');
        
        try {
          const json = JSON.parse(str);
          console.log('JSON Parse: OK');
          console.log('eventName:', json.eventName);
          console.log('date:', json.date);
        } catch (e) {
          console.error('JSON Parse: FAILED', e.message);
          // Show char codes to detect BOM or hidden chars
          console.log('Char codes:', str.split('').map(c => c.charCodeAt(0)));
        }
      } catch (e) {
        console.log('File not found or error:', e.message);
      }
    }
  } catch (err) {
    console.error('List error:', err);
  }
}

debugMeta();
