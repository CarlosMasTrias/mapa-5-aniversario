// Cloudflare Worker – upload proxy for Cloudflare R2
//
// Deploy from the workers/ directory:
//   npx wrangler deploy
// Or paste into the Cloudflare dashboard (Workers → Create Worker).
//
// Required Worker secrets (set via `wrangler secret put` or dashboard):
//   UPLOAD_SECRET   – same value as VUE_APP_R2_UPLOAD_SECRET in your .env
//   PUBLIC_URL      – your R2 public URL, e.g. https://pub-xxxx.r2.dev
//
// Required R2 binding in wrangler.toml:
//   [[r2_buckets]]  binding = "R2_BUCKET"  bucket_name = "your-bucket-name"

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Secret',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // Verify shared secret
    const secret = request.headers.get('X-Upload-Secret')
    if (!secret || secret !== env.UPLOAD_SECRET) {
      return new Response('Unauthorized', { status: 401, headers: cors })
    }

    const url = new URL(request.url)
    // Key is the full path after the Worker domain, e.g. /fotos/US/ciudad/file.webp
    const key = url.pathname.slice(1)
    if (!key || key.includes('..')) {
      return new Response('Invalid path', { status: 400, headers: cors })
    }

    if (request.method === 'PUT') {
      const contentType = request.headers.get('Content-Type') || 'application/octet-stream'
      await env.R2_BUCKET.put(key, request.body, { httpMetadata: { contentType } })
      return new Response(
        JSON.stringify({ ok: true, src: `${env.PUBLIC_URL}/${key}` }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (request.method === 'DELETE') {
      await env.R2_BUCKET.delete(key)
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response('Method not allowed', { status: 405, headers: cors })
  },
}
