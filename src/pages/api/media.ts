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

      const events: Array<{ folder: string; meta: Meta | null; files: Array<{ name: string; url: string }> }> = []
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
        const files = (filesList.objects || [])
          .map((o: any) => o.key as string)
          .map((k: string) => k.split('/').pop() || '')
          .filter((name: string) => isAllowedFile(name))
          .map((name: string) => ({ name, url: `/media/${folder}/${name}` }))
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

    for (const [safe, f] of unique) {
      const ab = await f.arrayBuffer()
      const key = `${prefix}${folder}/${safe}`
      await bucket.put(key, ab, { httpMetadata: { contentType: contentTypeFor(safe) } })
      savedFiles.push(safe)
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
