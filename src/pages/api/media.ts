import type { APIRoute } from 'astro'
import path from 'path'
import fs from 'fs/promises'
import { createSlug } from '../../utils/slug'

export const prerender = false

type Meta = {
  eventName: string
  date: string
  description?: string
}

const MEDIA_ROOT = path.join(process.cwd(), 'public', 'media')

async function ensureDir(p: string) {
  try {
    await fs.mkdir(p, { recursive: true })
  } catch {}
}

async function readMeta(dir: string): Promise<Meta | null> {
  try {
    const txt = await fs.readFile(path.join(dir, 'meta.txt'), 'utf-8')
    const json = JSON.parse(txt)
    return json
  } catch {
    return null
  }
}

async function writeMeta(dir: string, meta: Meta): Promise<void> {
  const content = JSON.stringify(meta)
  await fs.writeFile(path.join(dir, 'meta.txt'), content, 'utf-8')
}

function isAllowedFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  const images = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  const videos = ['.mp4', '.webm', '.ogg']
  return images.includes(ext) || videos.includes(ext)
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const ext = path.extname(name)
  const slug = createSlug(base)
  return `${slug}${ext}`
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('list')
    if (q !== 'events') {
      return new Response(JSON.stringify({ error: 'invalid list' }), { status: 400 })
    }

    await ensureDir(MEDIA_ROOT)
    const dirs = await fs.readdir(MEDIA_ROOT, { withFileTypes: true })
    const events: Array<{ folder: string; meta: Meta | null; files: Array<{ name: string; url: string }> }> = []

    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const full = path.join(MEDIA_ROOT, d.name)
      const meta = await readMeta(full)
      const names = await fs.readdir(full)
      const files = names
        .filter(n => isAllowedFile(n))
        .map(n => ({ name: n, url: `/media/${d.name}/${n}` }))
      events.push({ folder: d.name, meta, files })
    }

    return new Response(JSON.stringify({ events }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'list failed' }), { status: 500 })
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData()
    const eventName = String(form.get('eventName') || '')
    const date = String(form.get('date') || '')
    const description = form.get('description') ? String(form.get('description')) : undefined
    const existingFolder = form.get('existingFolder') ? String(form.get('existingFolder')) : undefined
    const files = form.getAll('files') as File[]

    if (!eventName || !date) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400 })
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return new Response(JSON.stringify({ error: 'invalid date' }), { status: 400 })
    }

    const folder = existingFolder && existingFolder.length > 0
      ? existingFolder
      : `${createSlug(eventName)}-${date.replace(/-/g, '')}`

    const targetDir = path.join(MEDIA_ROOT, folder)
    await ensureDir(targetDir)

    const savedFiles: string[] = []
    for (const f of files) {
      if (!f || !f.name) continue
      if (!isAllowedFile(f.name)) continue
      const ab = await f.arrayBuffer()
      const buf = Buffer.from(ab)
      const safe = sanitizeFilename(f.name)
      const filePath = path.join(targetDir, safe)
      await fs.writeFile(filePath, buf)
      savedFiles.push(safe)
    }

    const meta: Meta = { eventName, date, description }
    await writeMeta(targetDir, meta)

    try {
      const RESEND_API_KEY = import.meta.env.RESEND_API_KEY
      if (RESEND_API_KEY) {
        const subject = `Nuovo contenuto caricato: ${eventName}`
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2>Nuovo upload</h2>
            <p><strong>Evento:</strong> ${eventName}</p>
            <p><strong>Data evento:</strong> ${date}</p>
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

    return new Response(JSON.stringify({
      folder,
      files: savedFiles,
      meta
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upload failed' }), { status: 500 })
  }
}
