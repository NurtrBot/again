import 'server-only';
/* Server-side data loaders for route pages. Every loader is owner-scoped:
 * pass the session user's id; unknown or foreign ids resolve to null.
 * (UI agents: code against these signatures; implementations live in services.) */
import { redirect } from 'next/navigation';
import type { Checkout, CreditHistory, Credits, Draft, Film, FilmList, Job, PaymentStatus, Subscription } from '@/src/domain/types';
import { getEnv, publicConfig, type PublicConfig } from './env';
import { getSessionUser, type SessionUser } from './auth/session';
import { creditsService } from './services/credits';
import { draftsService } from './services/drafts';
import { generationsService } from './services/generations';
import { filmsService } from './services/films';
import { billingService } from './services/billing';

export interface Viewer {
  user: SessionUser | null;
  credits: Credits | null;
  config: PublicConfig;
  demo: boolean;
}

export async function loadViewer(): Promise<Viewer> {
  const env = getEnv();
  const user = await getSessionUser();
  const credits = user ? await creditsService.balance(user.id) : null;
  return { user, credits, config: publicConfig(), demo: env.demo.any };
}

/** Redirects to /auth (keeping returnTo) when signed out; to /onboarding when not onboarded (unless allowed). */
export async function requireViewer(returnTo: string, opts: { allowOnboarding?: boolean } = {}): Promise<Viewer & { user: SessionUser; credits: Credits }> {
  const v = await loadViewer();
  if (!v.user) redirect(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  if (!v.user.onboardingComplete && !opts.allowOnboarding) redirect(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  return v as Viewer & { user: SessionUser; credits: Credits };
}

export const loadDraft = (userId: string, draftId: string): Promise<Draft | null> => draftsService.get(userId, draftId);
export const loadLatestDraft = (userId: string): Promise<Draft | null> => draftsService.latest(userId);
export const loadJob = (userId: string, jobId: string): Promise<Job | null> => generationsService.get(userId, jobId);
export const loadFilm = (userId: string, filmId: string): Promise<Film | null> => filmsService.get(userId, filmId);
export const loadFilms = (userId: string, filter: 'all' | 'ready' | 'creating' = 'all', cursor?: string | null): Promise<FilmList> =>
  filmsService.list(userId, filter, cursor ?? null);
export const loadCredits = (userId: string): Promise<Credits> => creditsService.balance(userId);
export const loadCreditHistory = (userId: string, cursor?: string | null): Promise<CreditHistory> => creditsService.history(userId, cursor ?? null);
export const loadSubscription = (userId: string): Promise<Subscription> => billingService.subscription(userId);
export const loadCheckout = (userId: string, checkoutId: string): Promise<Checkout | null> => billingService.getCheckout(userId, checkoutId);
export const loadPaymentStatus = (userId: string, sessionId: string): Promise<PaymentStatus | null> => billingService.sessionStatus(userId, sessionId);
