import type { APIRoute } from 'astro'

export const prerender = false

function absUrl(req: Request, src: string): string {
  const base = new URL(req.url)
  if (/^https?:\/\//i.test(src)) return src
  const path = src.startsWith('/') ? src : '/' + src
  return `${base.origin}${path}`
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const u = new URL(request.url)
    const src = u.searchParams.get('src') || ''
    if (!src) return new Response('Not found', { status: 404 })
    const w = Number(u.searchParams.get('w') || '500')
    const q = Number(u.searchParams.get('q') || '80')
    const f = (u.searchParams.get('f') || 'auto').toLowerCase()
    const fit = (u.searchParams.get('fit') || 'scale-down') as any
    const originSrc = absUrl(request, src)
    const res = await fetch(originSrc, { cache: 'no-store' })
    if (!res.ok) {
      return new Response('Not found', { status: 404 })
    }
    const headers = new Headers()
    headers.set('Cache-Control', 'public, max-age=3600')
    const ct = res.headers.get('content-type') || 'image/jpeg'
    headers.set('Content-Type', ct)
    return new Response(res.body, { status: 200, headers, cf: { image: { width: w, quality: q, format: f as any, fit } } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
