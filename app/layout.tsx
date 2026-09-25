import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastRegion } from '@/src/ui/toast';

const interTight = localFont({
  src: [
    { path: '../src/fonts/inter-tight-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../src/fonts/inter-tight-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-inter-tight',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});
const inter = localFont({
  src: [
    { path: '../src/fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../src/fonts/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../src/fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../src/fonts/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});
const plexMono = localFont({
  src: [
    { path: '../src/fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../src/fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
});

export const metadata: Metadata = {
  title: { default: 'again.', template: '%s · again.' },
  description: 'Give your photo a pulse. One photo. Ten seconds of life.',
  applicationName: 'again.',
  appleWebApp: { capable: true, title: 'again.', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#023bf3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <ToastRegion />
      </body>
    </html>
  );
}
