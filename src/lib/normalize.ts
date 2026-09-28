import { buildProductionEpisodeUrl } from './episode-url';
import { isHlsUri, toPublicMediaUrl } from './media-url';
import type {
  CmsMediaAsset,
  CmsPagedResponse,
  CmsPodcastEpisode,
} from './cms-types';
import type { Episode, EpisodesPage, MediaAsset, MediaKindName } from './types';

function trimmed(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const out = value.trim();
  return out === '' ? null : out;
}

function positiveNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function booleanOr(value: boolean | null | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** `podcast-episodes/read-models` → lista odcinków. */
export function normalizeEpisodesPage(payload: CmsPagedResponse<CmsPodcastEpisode>): EpisodesPage {
  const episodes = (payload.data ?? []).map(normalizeEpisode).filter(isRenderable);

  return {
    episodes,
    pageNumber: Number.isFinite(payload.pageNumber) ? payload.pageNumber : 1,
    pageSize: Number.isFinite(payload.pageSize) ? payload.pageSize : episodes.length,
    total: Number.isFinite(payload.total) ? payload.total : episodes.length,
    totalPages: Number.isFinite(payload.totalPages) ? payload.totalPages : 1,
  };
}

function isRenderable(episode: Episode): boolean {
  return typeof episode.id === 'string' && episode.id !== '';
}

export function normalizeEpisode(raw: CmsPodcastEpisode): Episode {
  const podcastSlug = trimmed(raw.podcastSlug);
  const slug = trimmed(raw.slug);

  const mainImage = raw.mainImage;
  const imageUri = trimmed(mainImage?.uri);
  const externalAudioId = trimmed(raw.externalAudioId);
  const externalVideoId = trimmed(raw.externalVideoId);

  return {
    id: raw.id,
    title: trimmed(raw.title) ?? 'Bez tytułu',
    description: trimmed(raw.description),
    slug: slug ?? '',
    podcastSlug: podcastSlug ?? '',
    podcastTitle: trimmed(raw.podcastTitle) ?? 'Nieznany podcast',
    productionUrl: buildProductionEpisodeUrl(podcastSlug, slug),
    audioDuration: positiveNumber(raw.audioDuration),
    videoDuration: positiveNumber(raw.videoDuration),
    externalAudioId,
    externalVideoId,
    // `hasAudio`/`hasVideo` bywają niespójne z identyfikatorami — do odtwarzania
    // realnie nadaje się tylko odcinek, dla którego mamy `external*Id`.
    hasAudio: externalAudioId !== null && booleanOr(raw.hasAudio, true),
    hasVideo: externalVideoId !== null && booleanOr(raw.hasVideo, true),
    publishDate: trimmed(raw.publishDate),
    image: imageUri
      ? { uri: imageUri, title: trimmed(mainImage?.altTitle) ?? trimmed(mainImage?.title) ?? '' }
      : null,
    categoryName: trimmed(raw.category?.name),
    brandName: trimmed(raw.brand?.name),
  };
}

/**
 * `audio/{externalAudioId}` / `video/{externalVideoId}` → gotowy asset.
 * Zwraca `null`, gdy CMS nie dał publicznie dostępnego `uri`.
 */
export function normalizeMediaAsset(
  raw: CmsMediaAsset,
  kind: MediaKindName,
  fallbackDuration: number | null = null,
): MediaAsset | null {
  const url = toPublicMediaUrl(raw.uri);
  if (url === null) return null;

  return {
    kind,
    id: raw.id,
    title: trimmed(raw.title) ?? (kind === 'video' ? 'Materiał wideo' : 'Materiał audio'),
    url,
    sourceUri: null,
    durationSeconds: positiveNumber(raw.durationSeconds) ?? fallbackDuration,
    vttUrl: toPublicMediaUrl(raw.transcription?.vttUri),
    isHls: isHlsUri(url),
    fileName: trimmed(raw.fileName),
  };
}
