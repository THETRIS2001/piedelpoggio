import type { APIRoute } from 'astro'
import { createSlug } from '../../utils/slug'
import { buildMediaUploadEmail } from '../../utils/emailTemplates'

export const prerender = false

type Meta = {
  eventName: string
  date: string
  description?: string
}

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

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

const VIDEO_EXTS = ['.mp4', '.webm', '.ogg']

// Limite per singolo video, non complessivo. Il controllo lato client è solo
// un aiuto all'utente: questo è quello che fa testo.
const MAX_VIDEO_BYTES = 250 * 1024 * 1024

function isVideoFile(filename: string): boolean {
  return VIDEO_EXTS.includes(getExt(filename))
}

// Cloudflare limita il corpo di una richiesta a 100MB sui piani Free e Pro,
// quindi i file grossi vanno spezzati e ricomposti con il multipart di R2.
// PART_SIZE per MAX_PARTS dà esattamente il tetto per file: è questo, e non la
// dimensione dichiarata dal client, a mettere il limite vero.
const PART_SIZE = 25 * 1024 * 1024
const MAX_PARTS = Math.ceil(MAX_VIDEO_BYTES / PART_SIZE)

// I nomi cartella nascono sempre da createSlug(), quindi questo alfabeto basta
// e impedisce a un client di comporre chiavi fuori dal prefisso media/.
function isSafeFolder(folder: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(folder)
}

function isAllowedFile(filename: string): boolean {
  const ext = getExt(filename)
  const images = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
  return images.includes(ext) || VIDEO_EXTS.includes(ext)
}

function sanitizeFilename(name: string): string {
  const i = name.lastIndexOf('.')
  const base = i >= 0 ? name.slice(0, i) : name
  const ext = i >= 0 ? name.slice(i) : ''
  const slug = createSlug(base)
  return `${slug}${ext.toLowerCase()}`
}

function contentTypeFor(name: string): string {
  const ext = getExt(name)
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.bmp') return 'image/bmp'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogg') return 'video/ogg'
  return 'application/octet-stream'
}

type FolderResolution =
  | { ok: true, folder: string, meta: Meta | null }
  | { ok: false, error: string, status: number }

/**
 * Risolve la cartella dell'evento — riusando quella esistente o creandola con
 * il suo meta.txt — e la restituisce insieme ai metadati. Condivisa dal ramo
 * raw e da quello multipart, che avevano bisogno della stessa identica logica.
 */
async function resolveFolder(
  bucket: any,
  opts: { existingFolder?: string, eventName?: string, date?: string, description?: string }
): Promise<FolderResolution> {
  const prefix = 'media/'
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const { eventName = '', date = '', description } = opts
  let folder = opts.existingFolder && opts.existingFolder.length > 0 ? opts.existingFolder : ''
  let meta: Meta | null = null

  if (folder) {
    if (!isSafeFolder(folder)) {
      return { ok: false, error: 'invalid folder', status: 400 }
    }
    const metaKey = `${prefix}${folder}/meta.txt`
    try {
      const metaObj = await bucket.get(metaKey)
      if (metaObj) {
        const txt = await metaObj.text()
        // Remove BOM if present (code 65279 / 0xFEFF)
        const cleanTxt = txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt
        meta = JSON.parse(cleanTxt)
      }
    } catch { }
    if (!meta && eventName && date && dateRegex.test(date)) {
      meta = { eventName, date, description }
      await bucket.put(metaKey, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
    }
    if (meta && typeof description !== 'undefined') {
      meta = { ...meta, description }
      await bucket.put(metaKey, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
    }
    return { ok: true, folder, meta }
  }

  if (!eventName || !date) {
    return { ok: false, error: 'missing fields', status: 400 }
  }
  if (!dateRegex.test(date)) {
    return { ok: false, error: 'invalid date', status: 400 }
  }
  folder = `${createSlug(eventName)}-${date.replace(/-/g, '')}`
  meta = { eventName, date, description }
  await bucket.put(`${prefix}${folder}/meta.txt`, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
  return { ok: true, folder, meta }
}

async function listAll(bucket: any, options: any) {
  let truncated = true
  let cursor: string | undefined
  const allObjects: any[] = []
  const allPrefixes: Set<string> = new Set()

  while (truncated) {
    const res = await bucket.list({ ...options, cursor })
    truncated = res.truncated
    cursor = res.cursor
    if (res.objects) {
      for (const o of res.objects) allObjects.push(o)
    }
    if (res.delimitedPrefixes) {
      for (const p of res.delimitedPrefixes) allPrefixes.add(p)
    }
    if (!cursor) break
  }

  return { objects: allObjects, delimitedPrefixes: Array.from(allPrefixes) }
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url)
    const listParam = url.searchParams.get('list')
    const folderParam = url.searchParams.get('folder')

    const bucket = getBucket(locals)
    if (!bucket) {
      return new Response(JSON.stringify({ events: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const prefix = 'media/'

    if (listParam === 'events') {
      const mode = url.searchParams.get('mode')
      const listed = await listAll(bucket, { prefix, delimiter: '/' })
      const folders = new Set<string>()

      // Use delimitedPrefixes to get folders directly
      for (const p of listed.delimitedPrefixes || []) {
        const rest = p.slice(prefix.length)
        const seg = rest.replace(/\/$/, '')
        if (seg) folders.add(seg)
      }

      // Fallback: if delimitedPrefixes is empty (shouldn't happen with delimiter='/'), check objects too
      // just in case some files are at root level (though we want folders)
      for (const obj of listed.objects || []) {
        const key = obj.key || ''
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        const parts = rest.split('/')
        // If it has parts > 1, the first part is a folder, but it should have been in delimitedPrefixes
        // If parts == 1, it's a file in root media/, we ignore it for "folders" list
        if (parts.length > 1) {
          folders.add(parts[0])
        }
      }

      const events: Array<{ folder: string; meta: Meta | null; files: Array<{ name: string; url: string }> }> = []

      // Fetch metadata in parallel
      const folderList = Array.from(folders)
      const results = await Promise.all(folderList.map(async (folder) => {
        let meta: Meta | null = null
        try {
          const metaObj = await bucket.get(`${prefix}${folder}/meta.txt`)
          if (metaObj) {
            const txt = await metaObj.text()
            // Remove BOM if present (code 65279 / 0xFEFF)
            const cleanTxt = txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt
            meta = JSON.parse(cleanTxt)
          }
        } catch { }

        if (!meta || !meta.eventName) {
          return null
        }

        let files: any[] = []
        if (mode !== 'meta') {
          const filesList = await listAll(bucket, { prefix: `${prefix}${folder}/` })
          files = (filesList.objects || [])
            .filter((o: any) => isAllowedFile(o.key || ''))
            .map((o: any) => {
              const k = o.key as string
              const name = k.split('/').pop() || ''
              // Supporta sia 'size' che 'Size' per sicurezza
              const size = o.size || o.Size || 0
              return { name, url: `/media/${folder}/${name}`, size }
            })
        }

        return { folder, meta, files }
      }))

      for (const res of results) {
        if (res) events.push(res)
      }

      return new Response(JSON.stringify({ events }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (folderParam) {
      const folder = folderParam
      let meta: Meta | null = null
      try {
        const metaObj = await bucket.get(`${prefix}${folder}/meta.txt`)
        if (metaObj) {
          const txt = await metaObj.text()
          // Remove BOM if present (code 65279 / 0xFEFF)
          const cleanTxt = txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt
          meta = JSON.parse(cleanTxt)
        }
      } catch { }
      const filesList = await listAll(bucket, { prefix: `${prefix}${folder}/` })
      const files = (filesList.objects || [])
        .filter((o: any) => isAllowedFile(o.key || ''))
        .map((o: any) => {
          const k = o.key as string
          const name = k.split('/').pop() || ''
          const size = o.size || o.Size || 0
          return { name, url: `/media/${folder}/${name}`, size }
        })
      return new Response(JSON.stringify({ folder, meta, files }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'invalid list' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ events: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url)
    const notify = url.searchParams.get('notify') === '1'
    if (notify) {
      const bucket = getBucket(locals)
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'storage unavailable' }), { status: 503 })
      }
      let data: any = null
      try {
        const ct = request.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          data = await request.json()
        } else {
          const fd = await request.formData()
          data = {
            folder: String(fd.get('folder') || ''),
            eventName: String(fd.get('eventName') || ''),
            date: String(fd.get('date') || ''),
            description: fd.get('description') ? String(fd.get('description')) : undefined,
            files: (fd.getAll('files') || []).map((v) => String(v)),
          }
        }
      } catch { }
      const folderInput = String(data?.folder || '')
      const eventNameInput = String(data?.eventName || '')
      const dateInput = String(data?.date || '')
      const descriptionInput = typeof data?.description !== 'undefined' ? String(data.description) : undefined
      let folder = folderInput
      let meta: Meta | null = null
      const prefix = 'media/'
      if (!folder) {
        if (!eventNameInput || !dateInput) {
          return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400 })
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRegex.test(dateInput)) {
          return new Response(JSON.stringify({ error: 'invalid date' }), { status: 400 })
        }
        folder = `${createSlug(eventNameInput)}-${dateInput.replace(/-/g, '')}`
      }
      try {
        const m = await bucket.get(`${prefix}${folder}/meta.txt`)
        if (m) {
          const txt = await m.text()
          // Remove BOM if present (code 65279 / 0xFEFF)
          const cleanTxt = txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt
          meta = JSON.parse(cleanTxt)
        }
      } catch { }
      if (meta && typeof descriptionInput !== 'undefined') {
        meta = { ...meta, description: descriptionInput }
        await bucket.put(`${prefix}${folder}/meta.txt`, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
      }
      // Supporta sia string[] che {name, size}[] dal client
      let files: Array<{ name: string, size: number }> = []
      if (Array.isArray(data?.files) && data.files.length > 0) {
        files = data.files.map((x: any) => {
          if (typeof x === 'string') return { name: x, size: 0 }
          return { name: String(x.name || ''), size: Number(x.size || 0) }
        })
      }
      if (files.length === 0) {
        try {
          const filesList = await listAll(bucket, { prefix: `${prefix}${folder}/` })
          const objs = (filesList.objects || []).filter((o: any) => isAllowedFile(o.key || ''))
          files = objs.map((o: any) => ({
            name: (o.key as string).split('/').pop() || '',
            size: Number(o.size || o.Size || 0)
          }))
        } catch { }
      }
      try {
        const RESEND_API_KEY = (locals as any)?.runtime?.env?.RESEND_API_KEY || import.meta.env.RESEND_API_KEY
        if (RESEND_API_KEY) {
          const evName = (meta?.eventName) || eventNameInput || folder
          const evDate = (meta?.date) || dateInput || ''
          const subject = `📸 Upload completato: ${evName}`
          const html = buildMediaUploadEmail({
            eventName: evName,
            date: evDate,
            description: descriptionInput,
            files,
          })
          const payload = {
            from: 'Upload Media <onboarding@resend.dev>',
            to: ['pro.piedelpoggio@gmail.com'],
            subject,
            html,
          }
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })
        }
      } catch { }
      return new Response(JSON.stringify({ ok: true, folder, files, meta }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    // --- Upload multipart -------------------------------------------------
    // Serve per superare il tetto di 100MB per richiesta: il client spezza il
    // file in parti da PART_SIZE e le manda una per volta. Ogni parte viene
    // passata a R2 come stream, quindi i byte non entrano mai nella memoria
    // del Worker e il tempo CPU non cresce con la dimensione del file.
    const mp = url.searchParams.get('mp')
    if (mp) {
      const bucket = getBucket(locals)
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'storage unavailable' }), { status: 503 })
      }

      const safe = sanitizeFilename(String(url.searchParams.get('filename') || ''))
      if (!safe || !isAllowedFile(safe)) {
        return new Response(JSON.stringify({ error: 'Formato file non supportato' }), { status: 415 })
      }
      const prefix = 'media/'

      if (mp === 'create') {
        const declared = Number(url.searchParams.get('size') || 0)
        if (declared > MAX_VIDEO_BYTES) {
          return new Response(
            JSON.stringify({ error: `${isVideoFile(safe) ? 'Il video' : 'Il file'} supera il limite di 250MB` }),
            { status: 413 }
          )
        }
        const resolved = await resolveFolder(bucket, {
          existingFolder: url.searchParams.get('existingFolder') || undefined,
          eventName: String(url.searchParams.get('eventName') || ''),
          date: String(url.searchParams.get('date') || ''),
          description: url.searchParams.get('description') ? String(url.searchParams.get('description')) : undefined,
        })
        if (!resolved.ok) {
          return new Response(JSON.stringify({ error: resolved.error }), { status: resolved.status })
        }
        const key = `${prefix}${resolved.folder}/${safe}`
        const ct = String(url.searchParams.get('contentType') || '') || contentTypeFor(safe)
        const upload = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: ct } })
        return new Response(
          JSON.stringify({
            uploadId: upload.uploadId,
            folder: resolved.folder,
            filename: safe,
            partSize: PART_SIZE,
            maxParts: MAX_PARTS,
            meta: resolved.meta,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Da qui in poi la cartella è già stata creata da 'create': la si
      // riceve dal client e si ricompone la chiave lato server, senza mai
      // accettarla così com'è.
      const folder = String(url.searchParams.get('folder') || '')
      if (!isSafeFolder(folder)) {
        return new Response(JSON.stringify({ error: 'invalid folder' }), { status: 400 })
      }
      const uploadId = String(url.searchParams.get('uploadId') || '')
      if (!uploadId) {
        return new Response(JSON.stringify({ error: 'missing uploadId' }), { status: 400 })
      }
      const key = `${prefix}${folder}/${safe}`

      if (mp === 'part') {
        const partNumber = Number(url.searchParams.get('partNumber') || 0)
        // Numero di parti e dimensione massima di ognuna sono il vero limite
        // per file: insieme non lasciano superare MAX_PARTS * PART_SIZE.
        if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PARTS) {
          return new Response(JSON.stringify({ error: 'Il file supera il limite di 250MB' }), { status: 413 })
        }
        if (Number(request.headers.get('content-length') || 0) > PART_SIZE) {
          return new Response(JSON.stringify({ error: 'Parte troppo grande' }), { status: 413 })
        }
        const body = request.body
        if (!body) {
          return new Response(JSON.stringify({ error: 'missing body' }), { status: 400 })
        }
        const part = await bucket.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, body)
        return new Response(JSON.stringify({ partNumber: part.partNumber, etag: part.etag }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (mp === 'complete') {
        let parts: Array<{ partNumber: number, etag: string }> = []
        try {
          const data = await request.json() as any
          parts = Array.isArray(data?.parts) ? data.parts : []
        } catch { }
        if (parts.length === 0 || parts.length > MAX_PARTS) {
          return new Response(JSON.stringify({ error: 'parti mancanti o troppe' }), { status: 400 })
        }
        await bucket.resumeMultipartUpload(key, uploadId).complete(
          parts.map((x) => ({ partNumber: Number(x.partNumber), etag: String(x.etag) }))
        )
        return new Response(JSON.stringify({ folder, files: [safe] }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (mp === 'abort') {
        // Senza abort le parti già caricate restano su R2 e vengono fatturate.
        try {
          await bucket.resumeMultipartUpload(key, uploadId).abort()
        } catch { }
        return new Response(JSON.stringify({ aborted: true }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: 'azione multipart sconosciuta' }), { status: 400 })
    }

    const raw = url.searchParams.get('raw')
    if (raw === '1') {
      const bucket = getBucket(locals)
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'storage unavailable' }), { status: 503 })
      }

      const eventName = String(url.searchParams.get('eventName') || '')
      const date = String(url.searchParams.get('date') || '')
      const description = url.searchParams.get('description') ? String(url.searchParams.get('description')) : undefined
      const existingFolder = url.searchParams.get('existingFolder') ? String(url.searchParams.get('existingFolder')) : undefined
      const filename = String(url.searchParams.get('filename') || '')
      const contentTypeHint = String(url.searchParams.get('contentType') || '')

      if (!filename) {
        return new Response(JSON.stringify({ error: 'missing filename' }), { status: 400 })
      }

      const resolved = await resolveFolder(bucket, { existingFolder, eventName, date, description })
      if (!resolved.ok) {
        return new Response(JSON.stringify({ error: resolved.error }), { status: resolved.status })
      }
      const { folder, meta } = resolved
      const prefix = 'media/'

      const safe = sanitizeFilename(filename)
      if (!isAllowedFile(safe)) {
        return new Response(JSON.stringify({ error: 'Formato file non supportato' }), { status: 415 })
      }
      if (isVideoFile(safe)) {
        const declared = Number(request.headers.get('content-length') || 0)
        if (declared > MAX_VIDEO_BYTES) {
          return new Response(JSON.stringify({ error: 'Il video supera il limite di 250MB' }), { status: 413 })
        }
      }
      const key = `${prefix}${folder}/${safe}`
      const body = request.body
      if (!body) {
        return new Response(JSON.stringify({ error: 'missing body' }), { status: 400 })
      }
      const ct = contentTypeHint || contentTypeFor(safe)
      await bucket.put(key, body, { httpMetadata: { contentType: ct } })

      // no email here; final notification is handled via notify=1 branch

      return new Response(JSON.stringify({ folder, files: [safe], meta }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const form = await request.formData()
    const eventName = String(form.get('eventName') || '')
    const date = String(form.get('date') || '')
    const description = form.get('description') ? String(form.get('description')) : undefined
    const existingFolder = form.get('existingFolder') ? String(form.get('existingFolder')) : undefined
    const files = form.getAll('files') as File[]

    const bucket = getBucket(locals)
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'storage unavailable' }), { status: 503 })
    }

    let folder = existingFolder && existingFolder.length > 0 ? existingFolder : ''
    let meta: Meta | null = null

    const prefix = 'media/'

    if (folder) {
      const metaKey = `${prefix}${folder}/meta.txt`
      try {
        const metaObj = await bucket.get(metaKey)
        if (metaObj) {
          const txt = await metaObj.text()
          // Remove BOM if present (code 65279 / 0xFEFF)
          const cleanTxt = txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt
          meta = JSON.parse(cleanTxt)
        }
      } catch { }
      if (!meta && eventName && date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (dateRegex.test(date)) {
          meta = { eventName, date, description }
          await bucket.put(metaKey, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
        }
      }
      if (meta && typeof description !== 'undefined') {
        meta = { ...meta, description }
        await bucket.put(metaKey, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
      }
    } else {
      if (!eventName || !date) {
        return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400 })
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(date)) {
        return new Response(JSON.stringify({ error: 'invalid date' }), { status: 400 })
      }
      folder = `${createSlug(eventName)}-${date.replace(/-/g, '')}`
      meta = { eventName, date, description }
      const metaKey = `${prefix}${folder}/meta.txt`
      await bucket.put(metaKey, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
    }

    const savedFiles: string[] = []
    const unique = new Map<string, File>()
    for (const f of files) {
      if (!f || !f.name) continue
      if (!isAllowedFile(f.name)) continue
      const safe = sanitizeFilename(f.name)
      if (!unique.has(safe)) unique.set(safe, f)
    }

    const oversizedVideo = Array.from(unique.entries()).find(
      ([name, file]) => isVideoFile(name) && (file.size || 0) > MAX_VIDEO_BYTES
    )
    if (oversizedVideo) {
      return new Response(
        JSON.stringify({ error: `Il video ${oversizedVideo[0]} supera il limite di 250MB` }),
        { status: 413 }
      )
    }

    // Enforce total size limit 1GB and stream uploads to R2 to avoid high memory usage
    const MAX_TOTAL_BYTES = 1024 * 1024 * 1024
    const totalBytes = Array.from(unique.values()).reduce((acc, file) => acc + (file.size || 0), 0)
    if (totalBytes > MAX_TOTAL_BYTES) {
      return new Response(JSON.stringify({ error: 'Dimensione totale oltre il limite di 1GB' }), { status: 413 })
    }
    for (const [safe, f] of unique) {
      const dest = safe
      const key = `${prefix}${folder}/${dest}`
      const body: any = (f as any).stream ? (f as any).stream() : await f.arrayBuffer()
      const ct = contentTypeFor(dest)
      await bucket.put(key, body, { httpMetadata: { contentType: ct } })
      savedFiles.push(dest)
    }

    // no email here; final notification is handled via notify=1 branch

    return new Response(JSON.stringify({ folder, files: savedFiles, meta }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ error: 'upload failed' }), { status: 500 })
  }
}

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url)
    const purge = url.searchParams.get('purge')
    if (purge !== 'webp') {
      return new Response(JSON.stringify({ error: 'invalid purge' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const bucket = getBucket(locals)
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'storage unavailable' }), { status: 503 })
    }
    const prefix = 'media/'
    const listed = await listAll(bucket, { prefix })
    const objs = Array.from(listed.objects || [])
    let deleted = 0
    for (const obj of objs) {
      const key = String((obj as any).key || '')
      if (!key) continue
      const lower = key.toLowerCase()
      if (lower.endsWith('.webp') || lower.includes('/_thumbs/')) {
        try {
          await bucket.delete(key)
          deleted++
        } catch { }
      }
    }
    return new Response(JSON.stringify({ ok: true, deleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ error: 'purge failed' }), { status: 500 })
  }
}
