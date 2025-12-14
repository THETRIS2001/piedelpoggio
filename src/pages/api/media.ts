import type { APIRoute } from 'astro'
import { createSlug } from '../../utils/slug'

export const prerender = false

type Meta = {
  eventName: string
  date: string
  description?: string
}

function getBucket(locals: any): any | null {
  try {
    const env = locals?.runtime?.env as any
    return env?.MEDIA_BUCKET || null
  } catch {
    return null
  }
}

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function isAllowedFile(filename: string): boolean {
  const ext = getExt(filename)
  const images = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
  const videos = ['.mp4', '.webm', '.ogg']
  return images.includes(ext) || videos.includes(ext)
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
      for (const folder of folders) {
        let meta: Meta | null = null
        try {
          const metaObj = await bucket.get(`${prefix}${folder}/meta.txt`)
      if (metaObj) {
        const txt = await metaObj.text()
        // Remove BOM if present (code 65279 / 0xFEFF)
        const cleanTxt = txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt
        meta = JSON.parse(cleanTxt)
      }
        } catch {}
        if (!meta || !meta.eventName || !meta.date) {
          continue
        }
        const filesList = await listAll(bucket, { prefix: `${prefix}${folder}/` })
        const files = (filesList.objects || [])
          .filter((o: any) => isAllowedFile(o.key || ''))
          .map((o: any) => {
             const k = o.key as string
             const name = k.split('/').pop() || ''
             // Supporta sia 'size' che 'Size' per sicurezza
             const size = o.size || o.Size || 0
             return { name, url: `/media/${folder}/${name}`, size }
          })
        events.push({ folder, meta, files })
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
      } catch {}
      const filesList = await listAll(bucket, { prefix: `${prefix}${folder}/` })
      const files = (filesList.objects || [])
        .map((o: any) => o.key as string)
        .map((k: string) => k.split('/').pop() || '')
        .filter((name: string) => isAllowedFile(name))
        .map((name: string) => ({ name, url: `/media/${folder}/${name}` }))
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
      } catch {}
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
      } catch {}
      if (meta && typeof descriptionInput !== 'undefined') {
        meta = { ...meta, description: descriptionInput }
        await bucket.put(`${prefix}${folder}/meta.txt`, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } })
      }
      let files: string[] = Array.isArray(data?.files) ? data.files.map((x: any) => String(x)) : []
      if (files.length === 0) {
        try {
          const filesList = await listAll(bucket, { prefix: `${prefix}${folder}/` })
          files = (filesList.objects || [])
            .map((o: any) => o.key as string)
            .map((k: string) => k.split('/').pop() || '')
            .filter((name: string) => isAllowedFile(name))
        } catch {}
      }
      try {
        const RESEND_API_KEY = (locals as any)?.runtime?.env?.RESEND_API_KEY || import.meta.env.RESEND_API_KEY
        if (RESEND_API_KEY) {
          const subject = `Upload completato: ${(meta?.eventName) || eventNameInput || folder}`
          const filesHtml = files.map((n) => `${n}`).join('<br>')
          const html = `
            <div style="font-family: Arial, sans-serif;">
              <h2>Upload completato</h2>
              <p><strong>Evento:</strong> ${(meta?.eventName) || eventNameInput || folder}</p>
              <p><strong>Data evento:</strong> ${(meta?.date) || dateInput || ''}</p>
              ${descriptionInput ? `<p><strong>Descrizione:</strong> ${descriptionInput}</p>` : ''}
              <p><strong>File caricati (${files.length}):</strong><br>${filesHtml}</p>
            </div>
          `
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
      } catch {}
      return new Response(JSON.stringify({ ok: true, folder, files, meta }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
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
        } catch {}
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

      const safe = sanitizeFilename(filename)
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
      } catch {}
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
        } catch {}
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
