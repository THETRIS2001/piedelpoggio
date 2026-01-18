
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Risali di un livello dalla cartella scripts per trovare la root del progetto
const projectRoot = path.join(__dirname, '..');
const docsDir = path.join(projectRoot, 'public', 'documents', 'proloco');
const outputDir = path.join(projectRoot, 'src', 'data');
const outputFile = path.join(outputDir, 'docs-proloco.json');

// Assicura che la directory di output esista
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Scanning documents in: ${docsDir}`);

try {
    if (!fs.existsSync(docsDir)) {
        console.warn(`Directory not found: ${docsDir}. Creating empty docs list.`);
        fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
        process.exit(0);
    }

    const files = fs.readdirSync(docsDir);
    const docs = files
        .filter((name) => !name.startsWith('.') && /\.(pdf|docx?|xlsx?|pptx?)$/i.test(name))
        .map((name) => {
            const fullPath = path.join(docsDir, name);
            const stats = fs.statSync(fullPath);
            return {
                name: name.replace(/\.[^/.]+$/, ''),
                fileName: name,
                ext: (name.split('.').pop() || '').toUpperCase(),
                dateISO: stats.mtime.toISOString(), // Use mtime for sorting
                size: stats.size
            };
        })
        .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

    fs.writeFileSync(outputFile, JSON.stringify(docs, null, 2));
    console.log(`Generated ${outputFile} with ${docs.length} documents.`);

} catch (error) {
    console.error('Error generating docs JSON:', error);
    // Non fallire il build se c'è un errore, ma crea un array vuoto
    fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
}
