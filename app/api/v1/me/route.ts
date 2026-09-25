import { z } from 'zod';
import { route, ok, requireUser, readJson } from '@/src/server/http';
import { db } from '@/src/server/db';
import type { Profile } from '@/src/domain/types';

const patchSchema = z.object({ displayName: z.string().trim().min(1).max(80).optional(), onboardingComplete: z.boolean().optional() });

export const GET = route(async ({ req }) => {
  const u = await requireUser(req);
  const profile: Profile = { id: u.id, email: u.email, displayName: u.displayName, onboardingComplete: u.onboardingComplete };
  return ok(profile);
});

export const PATCH = route(async ({ req }) => {
  const u = await requireUser(req);
  const body = await readJson(req, patchSchema);
  const row = await db.one<{ display_name: string; onboarding_complete: boolean }>(
    `update public.profiles set display_name = coalesce($2, display_name), onboarding_complete = coalesce($3, onboarding_complete), updated_at = now() where id = $1 returning display_name, onboarding_complete`,
    [u.id, body.displayName ?? null, body.onboardingComplete ?? null],
  );
  const profile: Profile = { id: u.id, email: u.email, displayName: row!.display_name, onboardingComplete: row!.onboarding_complete };
  return ok(profile);
});
