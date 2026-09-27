import { getSiteUrl } from './site';

/**
 * Buduje link do odcinka na produkcyjnym serwisie Polskiego Radia:
 *
 *   https://www.polskieradio.pl/podcasty/{podcastSlug}/{slug}
 *
 * Celowo nie budujemy własnej podstrony odcinka — to wymóg zadania.
 */
export function buildProductionEpisodeUrl(
  podcastSlug: string | null | undefined,
  slug: string | null | undefined,
  siteUrl: string = getSiteUrl(),
): string | null {
  const podcast = (podcastSlug ?? '').trim();
  const episode = (slug ?? '').trim();

  if (podcast === '' || episode === '') return null;

  const base = siteUrl.replace(/\/+$/, '');
  return `${base}/podcasty/${encodeURIComponent(podcast)}/${encodeURIComponent(episode)}`;
}
