/* Local storage driver transport: signed PUT (uploads) and signed GET (reads with Range).
 * Only active when STORAGE_DRIVER=local. Supabase mode uses Supabase's own signed URLs. */
import { NextResponse } from 'next/server';
import { storage, BUCKETS, type Bucket } from '@/src/server/storage';
import { LocalStorage } from '@/src/server/storage/local';
import { db } from '@/src/server/db';

export const dynamic = 'force-dynamic';

function driver(): LocalStorage | null {
  const s = storage();
  return s instanceof LocalStorage ? s : null;
}

function parse(params: { bucket: string; key: string[] }): { bucket: Bucket; key: string } | null {
  if (!BUCKETS.includes(params.bucket as Bucket)) return null;
  const key = params.key.map(decodeURIComponent).join('/');
  if (key.includes('..') || key.startsWith('/')) return null;
  return { bucket: params.bucket as Bucket, key };
}

export async function PUT(req: Request, ctx: { params: Promise<{ bucket: string; key: string[] }> }) {
  const d = driver();
  if (!d) return new NextResponse(null, { status: 404 });
  const p = parse(await ctx.params);
  if (!p) return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';
  const len = Number(url.searchParams.get('len'));
  const ct = url.searchParams.get('ct') ?? '';
  if (!d.verify('put', p.bucket, p.key, exp, sig, `${ct}:${len}`)) return NextResponse.json({ error: { code: 'bad_signature' } }, { status: 403 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length !== len) return NextResponse.json({ error: { code: 'length_mismatch' } }, { status: 400 });
  if (body.length > 20 * 1024 * 1024) return NextResponse.json({ error: { code: 'too_large' } }, { status: 413 });
  const existing = await d.head(p.bucket, p.key);
  if (existing) return NextResponse.json({ error: { code: 'already_uploaded' } }, { status: 409 });
  await d.write(p.bucket, p.key, body);
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request, ctx: { params: Promise<{ bucket: string; key: string[] }> }) {
  const d = driver();
  if (!d) return new NextResponse(null, { status: 404 });
  const p = parse(await ctx.params);
  if (!p) return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';
  if (!d.verify('get', p.bucket, p.key, exp, sig)) return new NextResponse(null, { status: 403 });
  const head = await d.head(p.bucket, p.key);
  if (!head) return new NextResponse(null, { status: 404 });
  const asset = await db.one<{ mime_type: string | null; state: string }>('select mime_type, state from public.media_assets where storage_bucket=$1 and object_key=$2', [p.bucket, p.key]);
  if (asset && (asset.state === 'deleted' || asset.state === 'deleting')) return new NextResponse(null, { status: 404 });
  const contentType = asset?.mime_type ?? (p.bucket === 'films' ? 'video/mp4' : 'image/jpeg');
  const dl = url.searchParams.get('dl');
  const baseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  if (dl) baseHeaders['Content-Disposition'] = `attachment; filename="${dl.replace(/[^\w.\- ]/g, '_')}"`;
  const range = req.headers.get('range');
  const size = head.byteLength;
  if (range && d.readRange) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[2] && m[1] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      const chunk = await d.readRange(p.bucket, p.key, start, end);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: { ...baseHeaders, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(chunk.length) },
      });
    }
  }
  const data = await d.read(p.bucket, p.key);
  return new NextResponse(new Uint8Array(data), { status: 200, headers: { ...baseHeaders, 'Content-Length': String(data.length) } });
}
