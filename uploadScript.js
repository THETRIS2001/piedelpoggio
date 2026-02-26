import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const accessKeyId = "23ab8fb93543cd9b715a3f305813f87e";
const secretAccessKey = "1634ca2ed8bf96af29a21993740bde62b21eed9b7d474f92820106386b0ce6d8";
const endpoint = "https://2fc1f6539283b9d79329d9e2d6fc9281.r2.cloudflarestorage.com";
const bucket = "piedelpoggio-media";

const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
});

const baseDir = "C:/Users/Marco/SSD 2 TB (C)/Codici/Sitopdp/media";
const files = [];

function getFiles(dir) {
    for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) {
            getFiles(p);
        } else {
            files.push(p);
        }
    }
}

async function uploadWorker(fileQueue, workerId, totalFiles) {
    while (true) {
        const task = fileQueue.pop();
        if (!task) return; // No more work
        const { file, idx } = task;

        // Assicuriamoci di usare slash standard per il cloud
        const relativePath = file.substring(baseDir.length + 1).replace(/\\/g, '/');
        const key = `media/${relativePath}`;

        let ContentType = 'application/octet-stream';
        if (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')) ContentType = 'image/jpeg';
        else if (file.toLowerCase().endsWith('.png')) ContentType = 'image/png';
        else if (file.toLowerCase().endsWith('.mp4')) ContentType = 'video/mp4';
        else if (file.toLowerCase().endsWith('.txt')) ContentType = 'text/plain';

        try {
            const body = readFileSync(file);
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType,
            }));
            console.log(`[Caricati: ${idx}/${totalFiles}] OK: ${key}`);
        } catch (e) {
            console.log(`[Caricati: ${idx}/${totalFiles}] ERRORE ${key}: ${e.message}`);
        }
    }
}

async function start() {
    getFiles(baseDir);
    console.log(`\nTrovati ${files.length} file da caricare usando AWS SDK per S3...`);

    // Tasks are reversed so we can efficiently pop() them
    const tasks = files.map((file, i) => ({ file, idx: i + 1 })).reverse();
    const CONCURRENCY = 15;
    const workers = [];

    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(uploadWorker(tasks, i + 1, files.length));
    }

    await Promise.all(workers);
    console.log('\nCompletato!');
}

start();
