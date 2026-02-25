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

async function listAll(bucket: any, options: any) {
    let cursor: string | undefined
    const objects: any[] = []
    do {
        const res = await bucket.list({ ...options, cursor })
        if (res.objects) objects.push(...res.objects)
        cursor = res.truncated ? res.cursor : undefined
    } while (cursor)
    return { objects }
}

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url)
    const folder = url.searchParams.get('folder')
    if (!folder) {
        return new Response(JSON.stringify({ error: 'Missing folder param' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const bucket = getBucket(locals)
    if (!bucket) {
        return new Response(JSON.stringify({ error: 'Storage not available' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    try {
        const prefix = `documents/${folder}/`
        const result = await listAll(bucket, { prefix })
        const files = result.objects
            .map((o: any) => {
                const key = o.key as string
                return key.slice(prefix.length)
            })
            .filter((name: string) => name && !name.includes('/')) // solo file diretti, no sottocartelle

        return new Response(JSON.stringify({ files }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to list files' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
