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
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogg') return 'video/ogg'
  return 'application/octet-stream'
}

export const GET: APIRoute = async ({ params, locals, request }) => {
  const key = String(params.key || '')
  if (!key) {
    return new Response('Not found', { status: 404 })
  }
  const bucket = getBucket(locals)
  if (!bucket) {
    return new Response('Not found', { status: 404 })
  }
  try {
    const url = new URL(request.url)
    const isOriginalPath = key.startsWith('_original/')
    if (!isOriginalPath) {
      const w = url.searchParams.get('w')
      const h = url.searchParams.get('h')
      const q = url.searchParams.get('q')
      const fmt = url.searchParams.get('fmt')
      const needsResize = !!(w || h || q || fmt)
      if (needsResize) {
        const target = new URL(request.url)
        target.search = ''
        target.pathname = `/media/_original/${key}`
        const width = w ? parseInt(w, 10) : undefined
        const height = h ? parseInt(h, 10) : undefined
        const quality = q ? parseInt(q, 10) : 70
        const format = fmt || 'webp'
        const resp = await fetch(target.toString(), {
          cf: { image: { width, height, fit: 'cover', quality, format } }
        } as any)
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            'Content-Type': resp.headers.get('Content-Type') || 'image/webp',
            'Cache-Control': 'public, max-age=3600'
          }
        })
      }
    }
    const realKey = isOriginalPath ? key.replace(/^_original\//, '') : key
    const obj = await bucket.get(`media/${realKey}`)
    if (!obj) {
      return new Response('Not found', { status: 404 })
    }
    const body = await obj.arrayBuffer()
    const ct = (obj as any).httpMetadata?.contentType || contentTypeFor(realKey)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
