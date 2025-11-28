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
  const images = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
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
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogg') return 'video/ogg'
  return 'application/octet-stream'
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
      const listed = await bucket.list({ prefix })
      const folders = new Set<string>()
      for (const obj of listed.objects || []) {
        const key = obj.key || ''
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        const seg = rest.split('/')[0]
        if (seg) folders.add(seg)
      }

      const events: Array<{ folder: string; meta: Meta | null; files: Array<{ name: string; url: string; thumbUrl?: string }> }> = []
      for (const folder of folders) {
        let meta: Meta | null = null
        try {
          const metaObj = await bucket.get(`${prefix}${folder}/meta.txt`)
          if (metaObj) {
            const txt = await metaObj.text()
            meta = JSON.parse(txt)
          }
        } catch {}
        const filesList = await bucket.list({ prefix: `${prefix}${folder}/` })
        const thumbsList = await bucket.list({ prefix: `${prefix}${folder}/_thumbs/` })
        const thumbSet = new Set<string>((thumbsList.objects || []).map((o: any) => (o.key as string).split('/').pop() || ''))
        const files = (filesList.objects || [])
          .map((o: any) => o.key as string)
          .map((k: string) => k.split('/').pop() || '')
          .filter((name: string) => isAllowedFile(name))
          .map((name: string) => {
            const url = `/media/${folder}/${name}`
            const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(name)
            if (!isImg) return { name, url }
            const base = name.replace(/\.[^/.]+$/, '')
            const tname = `${base}.webp`
            const thumbUrl = thumbSet.has(tname) ? `/media/${folder}/_thumbs/${tname}` : undefined
            return thumbUrl ? { name, url, thumbUrl } : { name, url }
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
          meta = JSON.parse(txt)
        }
      } catch {}
      const filesList = await bucket.list({ prefix: `${prefix}${folder}/` })
      const thumbsList = await bucket.list({ prefix: `${prefix}${folder}/_thumbs/` })
      const thumbSet = new Set<string>((thumbsList.objects || []).map((o: any) => (o.key as string).split('/').pop() || ''))
      const files = (filesList.objects || [])
        .map((o: any) => o.key as string)
        .map((k: string) => k.split('/').pop() || '')
        .filter((name: string) => isAllowedFile(name))
        .map((name: string) => {
          const url = `/media/${folder}/${name}`
          const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(name)
          if (!isImg) return { name, url }
          const base = name.replace(/\.[^/.]+$/, '')
          const tname = `${base}.webp`
          const thumbUrl = thumbSet.has(tname) ? `/media/${folder}/_thumbs/${tname}` : undefined
          return thumbUrl ? { name, url, thumbUrl } : { name, url }
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
            meta = JSON.parse(txt)
          }
        } catch {}
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
      const isThumb = url.searchParams.get('thumb') === '1'
      const key = isThumb ? `${prefix}${folder}/_thumbs/${safe}` : `${prefix}${folder}/${safe}`
      const body = request.body
      if (!body) {
        return new Response(JSON.stringify({ error: 'missing body' }), { status: 400 })
      }
      const ct = contentTypeHint || contentTypeFor(safe)
      await bucket.put(key, body, { httpMetadata: { contentType: ct } })

      try {
        const RESEND_API_KEY = (locals as any)?.runtime?.env?.RESEND_API_KEY || import.meta.env.RESEND_API_KEY
        if (RESEND_API_KEY) {
          const subject = `Nuovo contenuto caricato: ${(meta?.eventName) || eventName || folder}`
          const html = `
            <div style="font-family: Arial, sans-serif;">
              <h2>Nuovo upload</h2>
              <p><strong>Evento:</strong> ${(meta?.eventName) || eventName}</p>
              <p><strong>Data evento:</strong> ${(meta?.date) || date}</p>
              ${description ? `<p><strong>Descrizione:</strong> ${description}</p>` : ''}
              <p><strong>File:</strong> ${safe}</p>
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
          meta = JSON.parse(txt)
        }
      } catch {}
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
      const isThumb = safe.startsWith('__thumb__')
      const dest = isThumb ? safe.replace(/^__thumb__-?/, '') : safe
      const key = isThumb ? `${prefix}${folder}/_thumbs/${dest}` : `${prefix}${folder}/${dest}`
      const body: any = (f as any).stream ? (f as any).stream() : await f.arrayBuffer()
      const ct = isThumb ? 'image/webp' : contentTypeFor(dest)
      await bucket.put(key, body, { httpMetadata: { contentType: ct } })
      savedFiles.push(dest)
    }

    try {
      const RESEND_API_KEY = (locals as any)?.runtime?.env?.RESEND_API_KEY || import.meta.env.RESEND_API_KEY
      if (RESEND_API_KEY) {
        const subject = `Nuovo contenuto caricato: ${(meta?.eventName) || eventName || folder}`
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2>Nuovo upload</h2>
            <p><strong>Evento:</strong> ${(meta?.eventName) || eventName}</p>
            <p><strong>Data evento:</strong> ${(meta?.date) || date}</p>
            ${description ? `<p><strong>Descrizione:</strong> ${description}</p>` : ''}
            <p><strong>File:</strong> ${savedFiles.join(', ')}</p>
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

    return new Response(JSON.stringify({ folder, files: savedFiles, meta }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ error: 'upload failed' }), { status: 500 })
  }
}
