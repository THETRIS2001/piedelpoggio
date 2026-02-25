import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function run() {
    try {
        const listCmd = new ListObjectsV2Command({
            Bucket: "piedelpoggio-media",
            Prefix: "media/",
        });
        const res = await client.send(listCmd);
        console.log("Files in piedelpoggio-media/media/:");
        if (res.Contents) {
            res.Contents.forEach((item) => {
                console.log("-", item.Key);
            });
        } else {
            console.log("No files found.");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
