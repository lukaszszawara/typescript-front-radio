import type { Metadata, Viewport } from 'next';
import { getSiteUrl } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'Podcasty Polskiego Radia — własny player audio/wideo',
  description:
    'Lista odcinków podcastów Polskiego Radia z własnym odtwarzaczem audio/wideo, napisami WebVTT i przełącznikiem formatu.',
  openGraph: {
    title: 'Podcasty Polskiego Radia',
    description: 'Odsłuchaj lub obejrzyj odcinki podcastów Polskiego Radia.',
    type: 'website',
    locale: 'pl_PL',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1120',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <a className="skip-link" href="#main">
          Przejdź do treści
        </a>
        {children}
      </body>
    </html>
  );
}
