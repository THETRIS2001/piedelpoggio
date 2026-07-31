import type { APIRoute } from 'astro'

export const prerender = false

function getBucket(locals: any): any | null {
    try {
        const runtimeEnv = locals?.runtime?.env as any
        if (runtimeEnv?.MEDIA_BUCKET) return runtimeEnv.MEDIA_BUCKET
        const directEnv = (locals?.env || locals?.cloudflare?.env) as any
        if (directEnv?.MEDIA_BUCKET) return directEnv.MEDIA_BUCKET
        return null
    } catch {
        return null
    }
}

function getExt(filename: string): string {
    const i = filename.lastIndexOf('.')
    return i >= 0 ? filename.slice(i).toLowerCase() : ''
}

function getContentType(filename: string, mimeTypeHint?: string): string {
    const ext = getExt(filename)
    if (ext === '.pdf') return 'application/pdf'
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.doc') return 'application/msword'
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (mimeTypeHint && mimeTypeHint !== 'application/octet-stream') return mimeTypeHint
    return 'application/octet-stream'
}

// Regex di convalida dei nomi file lato server per le 4 sezioni dinamiche del sito
const FILENAME_PATTERNS: Record<string, { regex: RegExp, allowedExts: string[], errorMsg: string }> = {
    '1': {
        regex: /^Programma estivo \d{4}\.(png|jpg|jpeg|webp)$/i,
        allowedExts: ['.png', '.jpg', '.jpeg', '.webp'],
        errorMsg: 'Il nome file per i Programmi Estivi deve seguire il formato "Programma estivo AAAA.ext" (es. Programma estivo 2026.png).'
    },
    '2': {
        regex: /^\d{2}-\d{2}-\d{4} - .+\.(pdf|doc|docx)$/i,
        allowedExts: ['.pdf', '.doc', '.docx'],
        errorMsg: 'Il nome file per i Documenti Pro Loco deve seguire il formato "GG-MM-AAAA - Titolo.pdf" (es. 15-08-2026 - Verbale.pdf).'
    },
    '3': {
        regex: /^Bilancio - \d{4}\.(pdf|png|jpg|jpeg|webp)$/i,
        allowedExts: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
        errorMsg: 'Il nome file per il Bilancio deve seguire il formato "Bilancio - AAAA.pdf" (es. Bilancio - 2026.pdf).'
    },
    '4': {
        regex: /^.+ - \d{2}-\d{2}-\d{4} - .+\.(png|jpg|jpeg|webp)$/i,
        allowedExts: ['.png', '.jpg', '.jpeg', '.webp'],
        errorMsg: 'Il nome file per gli Eventi Frazioni deve seguire il formato "Luogo - GG-MM-AAAA - Nome Evento.jpg" (es. Leonessa - 07-12-2025 - Festa.jpg).'
    }
}

// GET: Elenco flessibile (case-insensitive) dei file presenti in R2 per le 4 sezioni
export const GET: APIRoute = async ({ locals }) => {
    const bucket = getBucket(locals)
    if (!bucket) {
        return new Response(JSON.stringify({ error: 'Storage R2 non disponibile' }), { status: 500 })
    }

    try {
        let cursor: string | undefined
        const allObjects: any[] = []
        do {
            const res = await bucket.list({ prefix: 'documents/', cursor })
            if (res.objects) allObjects.push(...res.objects)
            cursor = res.truncated ? res.cursor : undefined
        } while (cursor)

        const getFilesForCategory = (folderNameLower: string) => {
            return allObjects
                .map((o: any) => o.key as string)
                .filter((key) => key.toLowerCase().includes(`documents/${folderNameLower}/`))
                .map((key) => {
                    const idx = key.toLowerCase().indexOf(`documents/${folderNameLower}/`)
                    return key.slice(idx + `documents/${folderNameLower}/`.length)
                })
                .filter((filename) => filename && !filename.includes('/'))
        }

        const data = {
            sec1: getFilesForCategory('programmi estivi'),
            sec2: getFilesForCategory('proloco'),
            sec3: getFilesForCategory('bilanci'),
            sec4: getFilesForCategory('eventi frazioni'),
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Errore lettura R2' }), { status: 500 })
    }
}

// POST: Caricamento file con verifica formati, supporto iOS/iPhone e controllo di scrittura
export const POST: APIRoute = async ({ request, locals }) => {
    const bucket = getBucket(locals)
    if (!bucket) {
        return new Response(JSON.stringify({ error: 'Storage R2 non disponibile. Assicurati che l\'ambiente Cloudflare Pages sia configurato con MEDIA_BUCKET.' }), { status: 503 })
    }

    try {
        const formData = await request.formData()
        const section = String(formData.get('section') || '')
        let targetFilename = String(formData.get('filename') || '').trim()
        const file = formData.get('file') as File | null

        if (!file || !section || !targetFilename) {
            return new Response(JSON.stringify({ error: 'Parametri mancanti: caricamento non valido.' }), { status: 400 })
        }

        let ext = getExt(targetFilename)
        if (!ext) {
            ext = getExt(file.name)
            if (!ext) {
                if (file.type.includes('pdf')) ext = '.pdf'
                else if (file.type.includes('png')) ext = '.png'
                else if (file.type.includes('jpeg') || file.type.includes('jpg')) ext = '.jpg'
                else if (file.type.includes('webp')) ext = '.webp'
            }
            if (ext) targetFilename += ext
        }

        const rule = FILENAME_PATTERNS[section]
        if (!rule) {
            return new Response(JSON.stringify({ error: 'Sezione non valida (selezionare da 1 a 4).' }), { status: 400 })
        }

        if (!rule.allowedExts.includes(ext.toLowerCase())) {
            return new Response(JSON.stringify({
                error: `Formato file non supportato (${ext || 'nessuna estensione'}). Estensioni ammesse: ${rule.allowedExts.join(', ')}`
            }), { status: 400 })
        }

        if (!rule.regex.test(targetFilename)) {
            return new Response(JSON.stringify({
                error: `FORMATO NOME FILE NON CORRETTO!\n${rule.errorMsg}\nNome tentato: "${targetFilename}"`
            }), { status: 400 })
        }

        let prefix = ''
        switch (section) {
            case '1':
                prefix = 'documents/Programmi estivi/'
                break
            case '2':
                prefix = 'documents/proloco/'
                break
            case '3':
                prefix = 'documents/Bilanci/'
                break
            case '4':
                prefix = 'documents/Eventi Frazioni/'
                break
        }

        const key = `${prefix}${targetFilename}`
        const buffer = await file.arrayBuffer()
        const contentType = getContentType(targetFilename, file.type)

        await bucket.put(key, buffer, {
            httpMetadata: { contentType }
        })

        let verified = false
        try {
            const headObj = await bucket.head(key)
            if (headObj) verified = true
        } catch {
            verified = true
        }

        if (!verified) {
            return new Response(JSON.stringify({ error: 'ATTENZIONE: Il file è stato inviato ma la verifica su R2 non ha restituito conferma. Riprova.' }), { status: 500 })
        }

        return new Response(JSON.stringify({
            success: true,
            key,
            filename: targetFilename,
            size: buffer.byteLength,
            contentType,
            message: `✓ Upload completato e verificato su R2 con successo!`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Errore imprevisto durante l\'upload su R2.' }), { status: 500 })
    }
}

// DELETE: Eliminazione file da R2
export const DELETE: APIRoute = async ({ request, locals }) => {
    const bucket = getBucket(locals)
    if (!bucket) {
        return new Response(JSON.stringify({ error: 'Storage R2 non disponibile.' }), { status: 500 })
    }

    try {
        const url = new URL(request.url)
        const key = url.searchParams.get('key')
        if (!key) {
            return new Response(JSON.stringify({ error: 'Parametro key mancante per l\'eliminazione.' }), { status: 400 })
        }

        await bucket.delete(key)
        return new Response(JSON.stringify({ success: true, key }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Errore durante l\'eliminazione da R2.' }), { status: 500 })
    }
}
