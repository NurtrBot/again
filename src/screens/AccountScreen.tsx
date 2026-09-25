'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { initialsFor } from '@/src/domain/helpers';
import type { Credits, Profile } from '@/src/domain/types';
import { Card, ChevronRight, Clock, Help, Lock } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';
import { clearLocalDrafts } from '@/src/ui/draft-store';
import { toast } from '@/src/ui/toast';

export interface AccountProps {
  demo?: boolean;
  review?: boolean;
  profile: Profile;
  credits: Credits;
}

export function AccountScreen({ demo, review, profile, credits }: AccountProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (review || signingOut) return;
    setSigningOut(true);
    try {
      await api.auth.signOut();
      await clearLocalDrafts();
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      router.replace('/');
      router.refresh();
    } catch {
      toast('We couldn’t sign you out. Please try again.');
      setSigningOut(false);
    }
  }

  const rows = [
    { label: COPY.s14.rows[0], href: '/account/billing', icon: <Card /> },
    { label: COPY.s14.rows[1], href: '/account/credits', icon: <Clock /> },
    { label: COPY.s14.rows[2], href: '/account/privacy', icon: <Lock /> },
    { label: COPY.s14.rows[3], href: '/help', icon: <Help /> },
  ];

  return (
    <Shell theme="white" nav="account" demo={demo}>
      <Header brandStart />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14, fontSize: 'clamp(2.5rem, 13.2vw, 3.4rem)' }}>
          {COPY.s14.heading}
        </h1>
        <div className="row-between" style={{ marginTop: 20 }}>
          <div className="row-center" style={{ justifyContent: 'flex-start', gap: 16, minWidth: 0 }}>
            <span className="avatar" aria-hidden>
              {initialsFor(profile.displayName, profile.email).slice(0, 1)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="display--md display" style={{ fontSize: 22, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>
                {profile.displayName || profile.email.split('@')[0]}
              </div>
              <div className="helper" style={{ fontSize: 16, marginTop: 2, overflowWrap: 'anywhere' }}>
                {profile.email}
              </div>
            </div>
          </div>
          <Link href="/account/profile" className="link link--cobalt" style={{ fontSize: 17, fontWeight: 400, flex: 'none' }}>
            {COPY.s14.edit}
          </Link>
        </div>

        <div className="balance-block" style={{ marginTop: 16, padding: '18px 20px 20px' }}>
          <div className="row-center" style={{ justifyContent: 'flex-start', gap: 12, alignItems: 'flex-start' }}>
            <span className="balance-block__num">{credits.available}</span>
            <span className="balance-block__label" style={{ marginTop: 8 }}>
              {COPY.s14.available}
            </span>
          </div>
          <div style={{ fontSize: 15, marginTop: 6, letterSpacing: '0.01em' }}>{COPY.s14.oneCredit}</div>
          {credits.held > 0 ? (
            <div style={{ fontSize: 14, marginTop: 4, opacity: 0.85 }}>
              {COPY.credits(credits.held)} reserved for {credits.held === 1 ? 'a film' : 'films'} in progress.
            </div>
          ) : null}
          <Button arrow href="/credits" style={{ marginTop: 14, fontSize: 20 }}>
            {COPY.s14.cta}
          </Button>
        </div>

        <div className="row-list" style={{ marginTop: 12 }}>
          {rows.map((r) => (
            <Link key={r.href} href={r.href} className="row">
              <span className="row__icon">{r.icon}</span>
              <span className="row__label">{r.label}</span>
              <span className="row__chevron">
                <ChevronRight />
              </span>
            </Link>
          ))}
        </div>
        <div className="center" style={{ marginTop: 16, paddingBottom: 20 }}>
          <button type="button" className="link link--cobalt" style={{ fontSize: 17, fontWeight: 400 }} onClick={signOut} disabled={signingOut}>
            {COPY.s14.signOut}
          </button>
        </div>
      </div>
    </Shell>
  );
}
