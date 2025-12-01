import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = process.env.MEDIA_API_BASE || 'https://piedelpoggio.org'
const PDP_DIR = process.env.PDP_DIR || path.join(__dirname, '..', 'pdp')
const CONCURRENCY = Number(process.env.CONCURRENCY || 2)
const LIMIT_FOLDERS = process.env.LIMIT_FOLDERS ? Number(process.env.LIMIT_FOLDERS) : null

const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.ogg'])

function getExt(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function contentTypeFor(name) {
  const ext = getExt(name)
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogg') return 'video/ogg'
  return 'application/octet-stream'
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function sanitizeFilename(name) {
  const i = name.lastIndexOf('.')
  const base = i >= 0 ? name.slice(0, i) : name
  const ext = i >= 0 ? name.slice(i) : ''
  const slug = slugify(base)
  return `${slug}${ext.toLowerCase()}`
}

async function readMeta(folderPath) {
  try {
    const txt = await fs.readFile(path.join(folderPath, 'meta.txt'), 'utf-8')
    const meta = JSON.parse(txt)
    if (!meta.eventName || !meta.date) throw new Error('invalid meta')
    return meta
  } catch {
    return null
  }
}

function parseFolderName(folderName) {
  const m = folderName.match(/^(.*)-(\d{8})$/)
  if (!m) return null
  const eventName = m[1].replace(/-/g, ' ').trim()
  const y = m[2].slice(0, 4)
  const mm = m[2].slice(4, 6)
  const d = m[2].slice(6, 8)
  return { eventName, date: `${y}-${mm}-${d}` }
}

async function listLocalFolders(baseDir) {
  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  return entries.filter(e => e.isDirectory()).map(e => e.name)
}

async function listLocalFiles(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  return entries
    .filter(e => e.isFile())
    .map(e => e.name)
    .filter(n => allowedExts.has(getExt(n)))
}

async function listRemoteFiles(folder) {
  const res = await fetch(`${BASE_URL}/api/media?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) return []
  const data = await res.json().catch(() => ({ files: [] }))
  const names = Array.isArray(data?.files) ? data.files.map(f => f.name) : []
  return names
}

async function getFolderInfo(folder) {
  const res = await fetch(`${BASE_URL}/api/media?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) return { meta: null, files: [] }
  const data = await res.json().catch(() => ({}))
  return {
    meta: data?.meta || null,
    files: Array.isArray(data?.files) ? data.files.map(f => f.name) : []
  }
}

async function createMetaForExistingFolder({ folder, eventName, date, description }) {
  const qs = new URLSearchParams()
  qs.set('raw', '1')
  qs.set('existingFolder', folder)
  qs.set('filename', 'meta.txt')
  qs.set('contentType', 'application/json')
  const url = `${BASE_URL}/api/media?${qs.toString()}`
  const payload = { eventName, date, description }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`create meta failed (${res.status}) ${txt}`)
  }
  return await res.json().catch(() => ({}))
}

async function uploadFileRaw({ folder, filePath, fileName, eventName, date, description }) {
  const safeName = sanitizeFilename(fileName)
  const ct = contentTypeFor(safeName)
  const qs = new URLSearchParams()
  qs.set('raw', '1')
  qs.set('filename', safeName)
  qs.set('contentType', ct)
  if (folder) qs.set('existingFolder', folder)
  if (!folder && eventName && date) {
    qs.set('eventName', eventName)
    qs.set('date', date)
    if (typeof description === 'string') qs.set('description', description)
  }
  const url = `${BASE_URL}/api/media?${qs.toString()}`
  const body = await fs.readFile(filePath)
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`upload failed (${res.status}) ${txt}`)
  }
  const json = await res.json().catch(() => ({}))
  return json
}

async function notifyFolder({ folder, eventName, date, description }) {
  const url = `${BASE_URL}/api/media?notify=1`
  const payload = { folder, eventName, date, description }
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  } catch {}
}

async function processFolder(folderName) {
  const folderPath = path.join(PDP_DIR, folderName)
  const meta = await readMeta(folderPath)
  const parsed = parseFolderName(folderName)
  const eventName = meta?.eventName || parsed?.eventName || folderName
  const date = meta?.date || parsed?.date || ''
  const description = typeof meta?.description === 'string' ? meta.description : undefined
  const canonicalFolder = (eventName && date) ? `${slugify(eventName)}-${date.replace(/-/g, '')}` : folderName

  const localFiles = await listLocalFiles(folderPath)
  if (localFiles.length === 0) {
    console.log(`- ${folderName}: nessun file da caricare`)
    return { folder: folderName, uploaded: 0, skipped: 0 }
  }

  const infoExact = await getFolderInfo(folderName).catch(() => ({ meta: null, files: [] }))
  const infoCanonical = await getFolderInfo(canonicalFolder).catch(() => ({ meta: null, files: [] }))
  const remoteFiles = (infoExact.files && infoExact.files.length > 0) ? infoExact.files : infoCanonical.files
  const targetFolder = (infoExact.files && infoExact.files.length > 0) ? folderName : canonicalFolder
  let uploaded = 0
  let skipped = 0
  let createdMeta = false

  // Ensure meta exists in the target folder
  if (!((infoExact.files && infoExact.files.length > 0 && infoExact.meta) || (infoCanonical.files && infoCanonical.files.length > 0 && infoCanonical.meta))) {
    try {
      if (targetFolder === folderName && (eventName && date)) {
        await createMetaForExistingFolder({ folder: folderName, eventName, date, description })
      } else if (eventName && date) {
        await createMetaForExistingFolder({ folder: canonicalFolder, eventName, date, description })
      }
      createdMeta = true
    } catch {}
  }

  for (let i = 0; i < localFiles.length; i++) {
    const f = localFiles[i]
    const safe = sanitizeFilename(f)
    if (remoteFiles.includes(safe)) {
      skipped++
      continue
    }
    const params = { folder: targetFolder, filePath: path.join(folderPath, f), fileName: f }
    await uploadFileRaw(params)
    createdMeta = true
    uploaded++
    if (uploaded % 10 === 0) {
      console.log(`  ${folderName}: caricati ${uploaded}/${localFiles.length}`)
    }
  }

  await notifyFolder({ folder: targetFolder, eventName, date, description })
  console.log(`✓ ${folderName}: ${uploaded} caricati, ${skipped} già presenti`)
  return { folder: folderName, uploaded, skipped }
}

async function run() {
  console.log(`Avvio upload verso ${BASE_URL} dalla cartella: ${PDP_DIR}`)
  let folders = await listLocalFolders(PDP_DIR)
  folders.sort((a, b) => a.localeCompare(b))
  if (LIMIT_FOLDERS && LIMIT_FOLDERS > 0) folders = folders.slice(0, LIMIT_FOLDERS)

  console.log(`Trovate ${folders.length} cartelle da processare`)

  const results = []
  const queue = [...folders]
  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, () => ({ busy: false }))

  async function next(workerIdx) {
    if (queue.length === 0) return
    const folderName = queue.shift()
    workers[workerIdx].busy = true
    try {
      const r = await processFolder(folderName)
      results.push(r)
    } catch (e) {
      console.error(`✗ Errore su ${folderName}:`, e.message || e)
    } finally {
      workers[workerIdx].busy = false
      await next(workerIdx)
    }
  }

  await Promise.all(workers.map((_, idx) => next(idx)))

  const totalUploaded = results.reduce((acc, r) => acc + (r.uploaded || 0), 0)
  const totalSkipped = results.reduce((acc, r) => acc + (r.skipped || 0), 0)
  console.log(`Completato. File caricati: ${totalUploaded}. File già presenti: ${totalSkipped}.`)
}

run().catch(err => {
  console.error('Errore fatale:', err)
  process.exit(1)
})

