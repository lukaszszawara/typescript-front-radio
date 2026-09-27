import type {
  CmsItemResponse,
  CmsMediaAsset,
  CmsPagedResponse,
  CmsPodcastEpisode,
  CmsProblemDetails,
} from './cms-types';
import { normalizeEpisodesPage, normalizeMediaAsset } from './normalize';
import type { EpisodesPage, MediaAsset, MediaKindName } from './types';

/** Domyślny brzegowy CMS — środowisko testowe (`dev-proxy`). */
export const DEFAULT_API_BASE_URL = 'https://cms-gateway.polskieradio.pl/dev-proxy';

const REQUEST_TIMEOUT_MS = 12_000;
/** Metadane mediów i lista odcinków są stabilne — cache'ujemy je w Next.js. */
const REVALIDATE_SECONDS = 300;

export class CmsError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.name = 'CmsError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Kolejność zmiennych: `API_BASE_URL` (server-only) → `NEXT_PUBLIC_API_BASE_URL`
 * (zgodne z zadaniem) → wartość domyślna.
 */
export function getApiBaseUrl(): string {
  const raw =
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function problemToMessage(problem: CmsProblemDetails | null, fallback: string): string {
  if (!problem) return fallback;
  const parts = [problem.title, problem.detail].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
  return parts.length > 0 ? parts.join(' — ') : fallback;
}

async function cmsFetch<T>(path: string, revalidate: number): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate },
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'nieznany błąd';
    throw new CmsError(`Nie udało się połączyć z API Polskiego Radia (${reason}).`, 503, url);
  }

  if (!response.ok) {
    let problem: CmsProblemDetails | null = null;
    try {
      problem = (await response.json()) as CmsProblemDetails;
    } catch {
      problem = null;
    }

    const fallback =
      response.status === 404
        ? 'Nie znaleziono zasobu w API Polskiego Radia.'
        : `API Polskiego Radia zwróciło błąd ${response.status}.`;

    throw new CmsError(problemToMessage(problem, fallback), response.status, url);
  }

  return (await response.json()) as T;
}

export async function fetchEpisodesPage(
  pageNumber: number,
  pageSize: number,
): Promise<EpisodesPage> {
  const query = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });

  const payload = await cmsFetch<CmsPagedResponse<CmsPodcastEpisode>>(
    `/podcast-episodes/read-models?${query.toString()}`,
    REVALIDATE_SECONDS,
  );

  return normalizeEpisodesPage(payload);
}

/** `null` oznacza: brak mediów / brak publicznie dostępnego `uri`. */
export async function fetchMediaAsset(
  kind: MediaKindName,
  id: string,
  fallbackDuration: number | null = null,
): Promise<MediaAsset | null> {
  const payload = await cmsFetch<CmsItemResponse<CmsMediaAsset>>(`/${kind}/${id}`, REVALIDATE_SECONDS);
  if (!payload.data) return null;
  return normalizeMediaAsset(payload.data, kind, fallbackDuration);
}
