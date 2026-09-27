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
