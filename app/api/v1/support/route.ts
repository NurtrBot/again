import { z } from 'zod';
import { route, ok, requireUser, readJson, zUuid, notFound } from '@/src/server/http';
import { db } from '@/src/server/db';

const schema = z.object({ subject: z.string().trim().min(1).max(120), message: z.string().trim().min(1).max(3000), jobId: zUuid.optional() });

export const POST = route(async ({ req }) => {
  const u = await requireUser(req);
  const body = await readJson(req, schema);
  if (body.jobId) {
    const owned = await db.one('select 1 from public.generations where id=$1 and user_id=$2', [body.jobId, u.id]);
    if (!owned) throw notFound('film');
  }
  const row = await db.one<{ id: string }>('insert into public.support_tickets(user_id, subject, message, generation_id) values ($1,$2,$3,$4) returning id', [u.id, body.subject, body.message, body.jobId ?? null]);
  console.log(`[support] ticket ${row!.id} from user ${u.id}: ${body.subject}`);
  return ok({ ticketId: row!.id, status: 'received' }, 201);
});
