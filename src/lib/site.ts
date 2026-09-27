/**
 * Publiczny host Polskiego Radia — linki z listy prowadzą na produkcję,
 * a nie na własną podstronę odcinka.
 */
export const DEFAULT_SITE_URL = 'https://www.polskieradio.pl';

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}
