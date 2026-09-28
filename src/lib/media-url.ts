/**
 * Normalizacja adresów mediów zwracanych przez CMS.
 *
 * W środowisku testowym `uri` może wskazywać na zasób dostępny wyłącznie
 * wewnątrz VPN Polskiego Radia, np.
 *
 *   https://dev-cms-gateway.polskieradio.pl/~~/portalfs.prsa.pl/UploadFiles$/...
 *
 * Taki adres jest bezużyteczny dla odtwarzacza w przeglądarce, dlatego
 * nadpisujemy go publicznym odpowiednikiem na CDN:
 *
 *   https://cdn6.polskieradio.pl/~/portalfs.prsa.pl/UploadFiles$/...
 */

/** Publiczny CDN dla zasobów „za VPN-em”. */
export const PUBLIC_CDN_BASE = 'https://cdn6.polskieradio.pl/~';

/** Znacznik odcinający w ścieżce adresu za VPN-em. */
export const VPN_PATH_MARKER = '/~~';

/** Hosty, które wskazują, że adres wymaga nadpisania. */
const VPN_HOSTS = new Set([
  'dev-cms-gateway.polskieradio.pl',
  'cms-gateway.polskieradio.pl',
]);

const PUBLIC_CDN_HOST = 'cdn6.polskieradio.pl';

const HLS_EXTENSIONS = ['.m3u8'];

function isVpnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return VPN_HOSTS.has(host) || host.startsWith('dev-');
}

/**
 * Zwraca publiczny, odtwarzalny adres zasobu albo `null`, gdy adres jest
 * nieprawidłowy / wskazuje na zasób niedostępny publicznie.
 */
export function toPublicMediaUrl(rawUri: string | null | undefined): string | null {
  if (typeof rawUri !== 'string') return null;

  const trimmed = rawUri.trim();
  if (trimmed === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const needsRewrite = isVpnHost(parsed.hostname) || parsed.pathname.includes(VPN_PATH_MARKER);
  if (!needsRewrite) return parsed.toString();

  let path = parsed.pathname;
  const markerIndex = path.indexOf(VPN_PATH_MARKER);
  if (markerIndex !== -1) {
    path = path.slice(markerIndex + VPN_PATH_MARKER.length);
  }

  // Adres po markerze bywa już prefiksem hostem CDN — nie dublujemy go.
  path = path.replace(new RegExp(`^/${PUBLIC_CDN_HOST}/`, 'i'), '/');

  const normalized = path.replace(/\/{2,}/g, '/');
  if (normalized === '/' || normalized === '') return null;

  return `${PUBLIC_CDN_BASE}${normalized}${parsed.search}${parsed.hash}`;
}

/** Czy adres wskazuje na strumień HLS (`.m3u8`)? */
export function isHlsUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const [withoutQuery = ''] = uri.split(/[?#]/);
  const lowered = withoutQuery.toLowerCase();
  return HLS_EXTENSIONS.some((ext) => lowered.endsWith(ext));
}

/**
 * Polskie Radio trzyma część nagrań jako `audio.wav`, ale zawartość pliku to
 * MPEG-1 Layer II (kodek `0x0050` = WAVE_FORMAT_MPEG w chunku `fmt `, 48 kHz
 * stereo, 256 kbps). Żadna przeglądarka nie ma dekodera Layer II — element
 * `<audio>` kończy na `MediaError` kod 4, a FFmpeg zgłasza „no supported streams”.
 * Nie da się tego obejść zmianą typu MIME ani nagłówków: bajty muszą zostać
 * zdekodowane przez przeglądarkę.
 *
 * CDN trzyma jednak obok tego samego materiału wariant `.mp3` o identycznym
 * czasie trwania i dwa razy mniejszy. Zmieniamy więc rozszerzenie i sprawdzamy
 * HEAD-em, czy wariant istnieje — podmiana „w ciemno” zepsułaby nagrania,
 * którym MP3 nie towarzyszy.
 */
const WAV_EXTENSION = '.wav';
const MP3_EXTENSION = '.mp3';

/** Nagłówek HTTP, którego oczekujemy od wariantu MP3. */
const PLAYABLE_MIME = 'audio/mpeg';

const PROBE_TIMEOUT_MS = 5_000;

export type MediaProbe = (url: string) => Promise<boolean>;

async function headProbe(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    return (response.headers.get('content-type') ?? '')
      .toLowerCase()
      .startsWith(PLAYABLE_MIME);
  } catch {
    return false;
  }
}

/**
 * Buduje adres wariantu MP3 dla pliku `.wav` (albo `null`, gdy zamiana
 * nie ma sensu). Query string i hash są zachowane.
 */
export function toMp3SiblingUrl(uri: string | null | undefined): string | null {
  if (typeof uri !== 'string') return null;

  const trimmed = uri.trim();
  if (trimmed === '') return null;

  const match = /^([^?#]*?)(\.wav)([?#].*)?$/i.exec(trimmed);
  if (match === null) return null;

  return `${match[1]}${MP3_EXTENSION}${match[3] ?? ''}`;
}

/**
 * Zwraca adres, który przeglądarka faktycznie odtworzy, oraz oryginalny,
 * gdy doszło do podmiany. Dla wszystkiego poza `.wav` nic nie robi.
 */
export async function resolvePlayableAudioUrl(
  uri: string | null | undefined,
  probe: MediaProbe = headProbe,
): Promise<{ url: string | null; sourceUri: string | null }> {
  const candidate = toMp3SiblingUrl(uri);
  if (candidate === null) {
    return { url: typeof uri === 'string' && uri.trim() !== '' ? uri.trim() : null, sourceUri: null };
  }

  // Awaria probe nie może wywrócić całej odpowiedzi — zostawiamy wtedy oryginał.
  const available = await probe(candidate).catch(() => false);

  if (available) {
    return { url: candidate, sourceUri: (uri as string).trim() };
  }

  return { url: (uri as string).trim(), sourceUri: null };
}
