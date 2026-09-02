import type { APIRoute } from 'astro'
import { contentTypeForName } from '../../lib/mediaTypes'

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

export const GET: APIRoute = async ({ params, request, locals }) => {
  const key = String(params.key || '')
  if (!key) {
    return new Response('Not found', { status: 404 })
  }
  const bucket = getBucket(locals)
  if (!bucket) {
    return new Response('Not found', { status: 404 })
  }

  const rangeHeader = request.headers.get('range')

  // Passando gli header a R2 è lui a interpretare il Range. Senza questo un
  // video veniva servito sempre per intero con 200: Safari, che per riprodurre
  // chiede prima un pezzetto e si aspetta 206, rinunciava e mostrava un
  // riquadro nero.
  const obj = rangeHeader
    ? await bucket.get(`media/${key}`, { range: request.headers })
    : await bucket.get(`media/${key}`)

  if (!obj) {
    return new Response('Not found', { status: 404 })
  }

  // Il tipo dedotto dall'estensione ha la precedenza su quello salvato: i file
  // caricati prima che i .mov fossero riconosciuti hanno in R2 un content-type
  // sbagliato, e riscriverli tutti non serve se lo si corregge qui.
  const fromName = contentTypeForName(key)
  const ct =
    fromName !== 'application/octet-stream'
      ? fromName
      : (obj as any).httpMetadata?.contentType || fromName

  const headers = new Headers({
    'Content-Type': ct,
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Va annunciato sempre, anche fuori dalle risposte parziali: è così che il
    // browser sa di poter cercare dentro il video invece di scaricarlo tutto.
    'Accept-Ranges': 'bytes',
  })
  if ((obj as any).httpEtag) headers.set('ETag', (obj as any).httpEtag)

  const total = Number((obj as any).size ?? 0)
  const range = (obj as any).range as
    | { offset?: number; length?: number; suffix?: number }
    | undefined

  if (rangeHeader && range) {
    const offset = Number(range.offset ?? 0)
    const length = Number(range.length ?? Math.max(total - offset, 0))
    const end = Math.max(offset + length - 1, offset)
    headers.set('Content-Range', `bytes ${offset}-${end}/${total}`)
    headers.set('Content-Length', String(length))
    return new Response(obj.body as unknown as BodyInit, { status: 206, headers })
  }

  if (total) headers.set('Content-Length', String(total))
  return new Response(obj.body as unknown as BodyInit, { status: 200, headers })
}

// Safari apre spesso un HEAD prima di riprodurre: senza, ricadeva sul GET
// completo solo per leggere durata e dimensione.
export const HEAD: APIRoute = async ({ params, locals }) => {
  const key = String(params.key || '')
  const bucket = getBucket(locals)
  if (!key || !bucket) return new Response(null, { status: 404 })

  const obj = await bucket.head(`media/${key}`)
  if (!obj) return new Response(null, { status: 404 })

  const fromName = contentTypeForName(key)
  const headers = new Headers({
    'Content-Type':
      fromName !== 'application/octet-stream'
        ? fromName
        : (obj as any).httpMetadata?.contentType || fromName,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(Number((obj as any).size ?? 0)),
  })
  if ((obj as any).httpEtag) headers.set('ETag', (obj as any).httpEtag)
  return new Response(null, { status: 200, headers })
}
