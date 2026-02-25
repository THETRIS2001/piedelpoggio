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

function getExt(name: string): string {
    const i = name.lastIndexOf('.')
    return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function contentTypeFor(name: string): string {
    const ext = getExt(name)
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.png') return 'image/png'
    if (ext === '.gif') return 'image/gif'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.pdf') return 'application/pdf'
    if (ext === '.doc') return 'application/msword'
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (ext === '.mp4') return 'video/mp4'
    if (ext === '.webm') return 'video/webm'
    if (ext === '.ogg') return 'video/ogg'
    return 'application/octet-stream'
}

export const GET: APIRoute = async ({ params, locals }) => {
    const rawPath = String(params.path || '')
    if (!rawPath) {
        return new Response('Not found', { status: 404 })
    }
    const bucket = getBucket(locals)
    if (!bucket) {
        return new Response('Not found', { status: 404 })
    }
    // Decode URI-encoded parts (e.g. %20 → space)
    const decodedPath = decodeURIComponent(rawPath)
    const obj = await bucket.get(`documents/${decodedPath}`)
    if (!obj) {
        return new Response('Not found', { status: 404 })
    }
    const body = await obj.arrayBuffer()
    const ct = (obj as any).httpMetadata?.contentType || contentTypeFor(decodedPath)
    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': ct,
            'Cache-Control': 'public, max-age=31536000, immutable'
        }
    })
}
