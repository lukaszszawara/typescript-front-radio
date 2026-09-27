/**
 * Formatowanie czasu i daty. Wszystkie funkcje są czyste i testowalne —
 * `formatDuration` przyjmuje `null`/`NaN` i zwraca placeholder zamiast „NaN”.
 */

export const EMPTY_DURATION = '—';

/** `1452` → `24:12`, `4636` → `1:17:16`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return EMPTY_DURATION;

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(secs).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Opis słowny czasu trwania, np. `24 min 12 s`. Używany w `title`/aria. */
export function formatDurationLong(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return EMPTY_DURATION;

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} godz.`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} s`);

  return parts.join(' ');
}

const DATE_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** `2026-07-01T06:05:00+02:00` → `1 lipca 2026`. */
export function formatPublishDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_FORMATTER.format(date);
}

/** Wybiera długość trwania odpowiednią dla wybranego formatu. */
export function pickDuration(
  audioDuration: number | null,
  videoDuration: number | null,
  kind: 'audio' | 'video',
): number | null {
  const primary = kind === 'video' ? videoDuration : audioDuration;
  const fallback = kind === 'video' ? audioDuration : videoDuration;
  return primary ?? fallback;
}
