import { NextResponse } from 'next/server';
import { route, requireUser, uuidParam } from '@/src/server/http';
import { filmsService } from '@/src/server/services/films';
import { storage } from '@/src/server/storage';
import { LocalStorage } from '@/src/server/storage/local';

/** Owner-checked on every request. Streams the verified stored output (local) or redirects to a scoped signed attachment URL. */
export const GET = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.filmId, 'film');
  const d = await filmsService.download(u.id, id);
  const s = storage();
  if (s instanceof LocalStorage) {
    const data = await s.read(d.bucket as never, d.key);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': d.mime,
        'Content-Length': String(data.length),
        'Content-Disposition': `attachment; filename="${d.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  return NextResponse.redirect(d.url, 302);
});
