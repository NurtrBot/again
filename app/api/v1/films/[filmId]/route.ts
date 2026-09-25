import { z } from 'zod';
import { route, ok, requireUser, readJson, uuidParam, notFound } from '@/src/server/http';
import { filmsService } from '@/src/server/services/films';

export const GET = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.filmId, 'film');
  const film = await filmsService.get(u.id, id);
  if (!film) throw notFound('film');
  return ok(film, 200, { 'Cache-Control': 'no-store' });
});

export const PATCH = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.filmId, 'film');
  const body = await readJson(req, z.object({ title: z.string().min(1).max(80) }));
  return ok(await filmsService.rename(u.id, id, body.title));
});

export const DELETE = route(async ({ req, params }) => {
  const u = await requireUser(req);
  const id = uuidParam(params.filmId, 'film');
  await filmsService.delete(u.id, id);
  return ok({ ok: true }, 202);
});
