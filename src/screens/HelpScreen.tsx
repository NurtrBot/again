'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api, ApiFailure } from '@/src/ui/api';

const FAQ = [
  { q: 'How does it work?', a: 'Choose one photo, pick a feeling (Gentle, Lively or Surprise me), and press Animate photo. Our AI planner looks at the photo and proposes small believable movement; a video model renders one continuous 10-second shot that starts exactly with your photo.' },
  { q: 'What does a credit buy?', a: 'One credit = one successfully delivered 10-second film, whichever feeling you choose. Credits are reserved when you press Animate and only spent once your film is ready.' },
  { q: 'What if my film doesn’t finish?', a: 'If the animation service can’t complete your video, the reserved credit is returned to your balance automatically. You’ll see “Your credit has been returned” once that’s confirmed, and you can try again.' },
  { q: 'How long does it take?', a: 'Usually a few minutes. You can leave the page — your film keeps rendering and appears in My films when it’s ready.' },
  { q: 'Can I download or share?', a: 'Yes. Save film downloads the MP4. Share sends the video file through your device’s share sheet. There is no public gallery or public link.' },
  { q: 'Do credits expire?', a: 'Purchased packs never expire. Monthly plan credits reset at each renewal; unused ones expire at the end of the paid period.' },
  { q: 'What photos work best?', a: 'JPG, PNG or HEIC up to 20 MB, at least 256 px on the short side. Clear, well-lit photos with one or two subjects animate most believably. Text, logos and faces are kept as they are; we can’t guarantee perfect face preservation.' },
];

export function HelpScreen({ demo, signedIn, jobId, supportEmail }: { demo?: boolean; signedIn: boolean; jobId?: string | null; supportEmail: string }) {
  const [subject, setSubject] = useState(jobId ? 'A film didn’t finish' : '');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const t = await api.support(subject.trim(), message.trim(), jobId ?? undefined);
      setDone(t.ticketId);
    } catch (ex) {
      const f = ex as ApiFailure;
      setError(f.fieldErrors?.message ?? f.fieldErrors?.subject ?? (f.status === 401 ? 'Please sign in to send a message.' : 'We couldn’t send that. Please try again.'));
      setPending(false);
    }
  }

  return (
    <Shell theme="white" demo={demo}>
      <Header backHref={signedIn ? '/account' : '/'} />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14 }}>
          How it works.
        </h1>
        <div className="stack" style={{ marginTop: 18 }}>
          {FAQ.map((f) => (
            <details key={f.q} style={{ borderBottom: '1.5px solid var(--line-2)', padding: '14px 0' }}>
              <summary style={{ fontSize: 18, fontWeight: 600, cursor: 'pointer', listStyle: 'none', minHeight: 32, display: 'flex', alignItems: 'center' }}>{f.q}</summary>
              <p style={{ marginTop: 8, fontSize: 16, lineHeight: 1.5, color: 'var(--muted)' }}>{f.a}</p>
            </details>
          ))}
        </div>

        <h2 className="display display--section" style={{ marginTop: 32 }}>
          Get help.
        </h2>
        {done ? (
          <div className="notice" style={{ marginTop: 14 }} role="status">
            <span>Thanks — we received your message. Reference {done.slice(0, 8)}.</span>
          </div>
        ) : signedIn ? (
          <form onSubmit={submit} className="stack gap-4" style={{ marginTop: 14, paddingBottom: 24 }} noValidate>
            {jobId ? (
              <p className="helper">
                Film reference: <code>{jobId.slice(0, 8)}</code> will be attached.
              </p>
            ) : null}
            <div className="field">
              <label className="field__label" htmlFor="subject">
                Subject
              </label>
              <input id="subject" className="input" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="message">
                Message
              </label>
              <textarea id="message" className="input textarea" value={message} maxLength={3000} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            {error ? (
              <div className="inline-error" role="alert">
                <Alert />
                <span>{error}</span>
              </div>
            ) : null}
            <Button type="submit" pending={pending} disabled={!subject.trim() || !message.trim()}>
              Send message
            </Button>
          </form>
        ) : (
          <p style={{ marginTop: 14, paddingBottom: 24, fontSize: 16 }}>
            <Link href="/auth?returnTo=/help" className="link link--cobalt">
              Sign in
            </Link>{' '}
            to send us a message, or email{' '}
            <a href={`mailto:${supportEmail}`} className="link">
              {supportEmail}
            </a>
            .
          </p>
        )}
      </div>
    </Shell>
  );
}
