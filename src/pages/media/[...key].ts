import type { APIRoute } from 'astro'

export const prerender = false

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

function contentTypeFor(name: string): string {
  const ext = getExt(name)
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogg') return 'video/ogg'
  return 'application/octet-stream'
}

export const GET: APIRoute = async ({ params, locals }) => {
  const key = String(params.key || '')
  if (!key) {
    return new Response('Not found', { status: 404 })
  }
  const bucket = getBucket(locals)
  if (!bucket) {
    return new Response('Not found', { status: 404 })
  }
  const obj = await bucket.get(`media/${key}`)
  if (!obj) {
    return new Response('Not found', { status: 404 })
  }
  const body = await obj.arrayBuffer()
  const ct = (obj as any).httpMetadata?.contentType || contentTypeFor(key)
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  })
}
