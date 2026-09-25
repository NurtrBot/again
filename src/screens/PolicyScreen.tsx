'use client';
import { Header, Shell } from '@/src/ui/primitives';

export function PolicyScreen({ demo, kind, supportEmail }: { demo?: boolean; kind: 'terms' | 'privacy'; supportEmail: string }) {
  const isTerms = kind === 'terms';
  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/" />
      <div className="shell__body" style={{ paddingBottom: 32 }}>
        <h1 className="display" style={{ marginTop: 14 }}>
          {isTerms ? 'Terms.' : 'Privacy Policy.'}
        </h1>
        <div className="notice" style={{ marginTop: 16, fontSize: 14, minHeight: 44 }} role="note">
          Draft — the owner must review and approve this policy before live payments.
        </div>
        <div className="stack gap-4" style={{ marginTop: 20, fontSize: 16, lineHeight: 1.55 }}>
          {isTerms ? (
            <>
              <p><strong>The service.</strong> again. turns one photo into a private 10-second video (“film”). You need an account and credits to generate films. Sample films shown before purchase are labeled examples.</p>
              <p><strong>Credits.</strong> One credit is consumed per successfully delivered film. Credit packs are one-time purchases and do not expire. Monthly plans add credits each paid period; unused monthly credits expire at the end of that period. Credits are not cash and are not refundable except where required by law.</p>
              <p><strong>Failed films.</strong> If a film cannot be completed, the reserved credit is returned once the failure is confirmed. Deleting a completed film does not return its credit.</p>
              <p><strong>Recurring billing.</strong> Monthly plans renew automatically until canceled. Cancel any time from Plans &amp; billing; the plan stays active until the end of the paid period. Plan changes apply at the next renewal.</p>
              <p><strong>Your content.</strong> You must have the right to use the photos you upload. Do not upload content that is unlawful or that the AI providers’ policies prohibit; such requests may be rejected without charge. Generated films are for your personal use.</p>
              <p><strong>No guarantees.</strong> Generated motion is probabilistic. We do not guarantee identity accuracy, likeness preservation, or suitability for any purpose.</p>
              <p><strong>Contact.</strong> {supportEmail}</p>
            </>
          ) : (
            <>
              <p><strong>What we collect.</strong> Your email (to sign you in), the photos you choose to animate, the films we generate, your feeling/direction choices, credit and billing records, and basic technical logs.</p>
              <p><strong>How photos are processed.</strong> To make a film, a normalized copy of your photo (with location and camera metadata removed) is sent to our AI providers: an OpenAI model that plans the motion and a video generation provider that renders it. They process it to produce your film. We store the original, the normalized copy, and the film in private storage tied to your account.</p>
              <p><strong>Payments.</strong> Card details are entered directly with Stripe and never touch our servers. We keep the receipt, amount, and product purchased.</p>
              <p><strong>Retention.</strong> Unused uploads are removed after 7 days. Films and their source photos are kept while your account is active or until you delete them. Payment records are kept as long as accounting and dispute rules require.</p>
              <p><strong>Sharing.</strong> Films are private: there is no public gallery or public link. Sharing sends the video file from your device through your own apps.</p>
              <p><strong>Your choices.</strong> Delete individual films at any time. Request account deletion from Privacy &amp; data; this purges your media and stops renewals.</p>
              <p><strong>Contact.</strong> {supportEmail}</p>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
