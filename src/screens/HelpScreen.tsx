'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, ArrowRight, ChatBubble, Check, ChevronRight, Minus, MotionWaves, Play, Plus } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { Sheet } from '@/src/ui/sheet';
import { api, ApiFailure } from '@/src/ui/api';

const FAQ = [
  { q: 'What does a credit buy?', a: 'One credit creates one 10-second film, whichever feeling you choose. Credits are reserved when you press Animate and only spent once your film is ready.' },
  { q: 'What if my film doesn’t finish?', a: 'If the animation service can’t complete your video, the reserved credit is returned to your balance automatically. You’ll see “Your credit has been returned” once that’s confirmed, and you can try again.' },
  { q: 'How long does it take?', a: 'Usually a few minutes. You can leave the page — your film keeps rendering and appears in My films when it’s ready.' },
  { q: 'Can I download or share?', a: 'Yes. Download film saves the MP4. Share sends the video file through your device’s share sheet. There is no public gallery or public link.' },
  { q: 'Do credits expire?', a: 'Purchased packs never expire. Monthly plan credits reset at each renewal; unused ones expire at the end of the paid period.' },
  { q: 'What photos work best?', a: 'JPG, PNG or HEIC up to 20 MB, at least 256 px on the short side. Clear, well-lit photos with one or two subjects animate most believably. Text, logos and faces are kept as they are; we can’t guarantee perfect face preservation.' },
];

export function HelpScreen({ demo, signedIn, jobId, supportEmail }: { demo?: boolean; signedIn: boolean; jobId?: string | null; supportEmail: string }) {
  const [open, setOpen] = useState(0);
  const [contact, setContact] = useState(!!jobId);
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
    <Shell theme="white" demo={demo} className="help-shell">
      <Header
        backHref={signedIn ? '/account' : '/'}
        center={
          <Link href="/" className="brand" aria-label="again. home">
            again<span className="text-cobalt">.</span>
          </Link>
        }
      />
      <div className="shell__body">
        <h1 className="display help__title">
          How it works<span className="text-cobalt">.</span>
        </h1>

        <ol className="help-steps" aria-label="How it works">
          <li className="help-step">
            <div className="help-step__art help-step__art--photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/samples/help-couple.jpg" alt="" />
              <span className="help-step__badge">
                <Plus />
              </span>
            </div>
            <span className="help-step__label">Pick a photo</span>
          </li>
          <li className="help-step__arrow" aria-hidden>
            <ChevronRight />
          </li>
          <li className="help-step">
            <div className="help-step__art help-step__art--card">
              <MotionWaves className="help-step__waves" />
            </div>
            <span className="help-step__label">Choose motion</span>
          </li>
          <li className="help-step__arrow" aria-hidden>
            <ChevronRight />
          </li>
          <li className="help-step">
            <div className="help-step__art help-step__art--card">
              <Play className="help-step__play" />
              <span className="help-step__badge">
                <Check />
              </span>
            </div>
            <span className="help-step__label">Keep your film</span>
          </li>
        </ol>

        <h2 className="display help__section">Good to know</h2>
        <div className="faq">
          {FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className={`faq__item${isOpen ? ' faq__item--open' : ''}`}>
                <button type="button" className="faq__q" aria-expanded={isOpen} aria-controls={`faq-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span>{f.q}</span>
                  {isOpen ? <Minus /> : <Plus />}
                </button>
                <div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="faq__a" hidden={!isOpen}>
                  {f.a}
                </div>
              </div>
            );
          })}
        </div>

        <section className="help-card" aria-labelledby="help-card-title">
          <div className="help-card__head">
            <div>
              <h2 className="display help-card__title" id="help-card-title">
                A little help?
              </h2>
              <p className="help-card__sub">We’re here for you.</p>
            </div>
            <ChatBubble className="help-card__icon" />
          </div>
          <button type="button" className="help-card__cta" onClick={() => setContact(true)}>
            <span>Contact us</span>
            <ArrowRight />
          </button>
        </section>
      </div>

      <Sheet open={contact} onClose={() => setContact(false)} label="Contact us">
        <div className="sheet__head" style={{ paddingRight: 48 }}>
          <div>
            <div className="sheet__title">Contact us</div>
            <div className="sheet__sub">We usually reply within a day.</div>
          </div>
        </div>
        {done ? (
          <div className="notice" style={{ marginTop: 14 }} role="status">
            <span>Thanks — we received your message. Reference {done.slice(0, 8)}.</span>
          </div>
        ) : signedIn ? (
          <form onSubmit={submit} className="stack gap-4" style={{ marginTop: 14, paddingBottom: 8 }} noValidate>
            {jobId ? (
              <p className="helper">
                Film reference <code>{jobId.slice(0, 8)}</code> will be attached.
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
          <p style={{ marginTop: 14, paddingBottom: 8, fontSize: 16 }}>
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
      </Sheet>
    </Shell>
  );
}
