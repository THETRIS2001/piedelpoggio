import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const accessKeyId = "23ab8fb93543cd9b715a3f305813f87e";
const secretAccessKey = "1634ca2ed8bf96af29a21993740bde62b21eed9b7d474f92820106386b0ce6d8";
const endpoint = "https://2fc1f6539283b9d79329d9e2d6fc9281.r2.cloudflarestorage.com";
const bucket = "piedelpoggio-media";

const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
});

async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}

async function run() {
    console.log("Cerco oggetti con cartelle che terminano in 0801 su R2...");
    let isTruncated = true;
    let continuationToken = undefined;

    const objectsToUpdate = [];

    while (isTruncated) {
        const response = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: "media/",
            ContinuationToken: continuationToken,
        }));

        if (response.Contents) {
            for (const obj of response.Contents) {
                // Cerco media/[Nome Evento]-[Anno]0801/[File]
                const regex = /^(media\/.+)-(\d{4})0801\/(.+)$/;
                const match = obj.Key.match(regex);
                if (match) {
                    objectsToUpdate.push({
                        oldKey: obj.Key,
                        newKey: `${match[1]}-${match[2]}08/${match[3]}`,
                        isMeta: match[3] === 'meta.txt',
                        basePart: match[1],
                        yearStr: match[2]
                    });
                }
            }
        }

        isTruncated = response.IsTruncated;
        continuationToken = response.NextContinuationToken;
    }

    console.log(`Trovati ${objectsToUpdate.length} file da migrare presenti nelle vecchie cartelle '1 agosto'.`);

    for (let i = 0; i < objectsToUpdate.length; i++) {
        const item = objectsToUpdate[i];
        console.log(`[${i + 1}/${objectsToUpdate.length}] Sposto: ${item.oldKey} -> ${item.newKey}`);

        try {
            if (item.isMeta) {
                const getRes = await s3.send(new GetObjectCommand({
                    Bucket: bucket,
                    Key: item.oldKey
                }));
                let content = await streamToString(getRes.Body);

                // Rimpiazza "date": "XXXX-08-01" con "date": "XXXX-08"
                content = content.replace(/"date":\s*"(\d{4}-08)-01"/g, '"date": "$1"');

                await s3.send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: item.newKey,
                    Body: content,
                    ContentType: 'text/plain; charset=utf-8'
                }));
            } else {
                // Modifica solo il percorso copiandolo, il file resta lo stesso
                await s3.send(new CopyObjectCommand({
                    Bucket: bucket,
                    CopySource: encodeURIComponent(`${bucket}/${item.oldKey}`),
                    Key: item.newKey
                }));
            }

            // Una volta copiato o modificato, cancello la vecchia path
            await s3.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: item.oldKey
            }));
        } catch (e) {
            console.error(`ERRORE processando ${item.oldKey}: ${e.message}`);
        }
    }

    console.log("Rinominazione completata su Cloudflare!");
}

run();
