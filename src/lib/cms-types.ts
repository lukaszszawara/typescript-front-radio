/**
 * Kształty odpowiedzi API CMS Polskiego Radia (uproszczone do faktycznie
 * używanych pól). Trzymamy je osobno od typów domenowych w `types.ts`,
 * żeby zmiany w API nie rozlewały się po komponentach.
 */

export interface CmsPagedResponse<T> {
  data: T[] | null;
  total: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface CmsItemResponse<T> {
  data: T | null;
}

export interface CmsProblemDetails {
  statusCode?: number;
  title?: string;
  detail?: string;
  instance?: string;
}

export interface CmsImage {
  id?: string | null;
  uri?: string | null;
  title?: string | null;
  altTitle?: string | null;
}

export interface CmsNamedRef {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
}

export interface CmsPodcastEpisode {
  id: string;
  title?: string | null;
  description?: string | null;
  slug?: string | null;
  podcastSlug?: string | null;
  podcastTitle?: string | null;
  publishDate?: string | null;
  audioDuration?: number | null;
  videoDuration?: number | null;
  externalAudioId?: string | null;
  externalVideoId?: string | null;
  hasAudio?: boolean | null;
  hasVideo?: boolean | null;
  mainImage?: CmsImage | null;
  category?: CmsNamedRef | null;
  brand?: CmsNamedRef | null;
}

export interface CmsTranscription {
  lang?: string | null;
  vttUri?: string | null;
  srtUri?: string | null;
  jsonUri?: string | null;
  subtitlesId?: string | null;
}

export interface CmsMediaAsset {
  id: string;
  title?: string | null;
  fileName?: string | null;
  uri?: string | null;
  durationSeconds?: number | null;
  transcription?: CmsTranscription | null;
}
