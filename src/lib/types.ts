import { getSiteUrl } from './site';

export interface EpisodeImage {
  readonly uri: string;
  readonly title: string;
}

export interface Episode {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly slug: string;
  readonly podcastSlug: string;
  readonly podcastTitle: string;
  /** Link na stronę odcinka na polskieradio.pl (nullptr, gdy brak slugów). */
  readonly productionUrl: string | null;
  readonly audioDuration: number | null;
  readonly videoDuration: number | null;
  /** Identyfikatory mediów w CMS — używane do pobrania assetu z `/audio/{id}` lub `/video/{id}`. */
  readonly externalAudioId: string | null;
  readonly externalVideoId: string | null;
  readonly hasAudio: boolean;
  readonly hasVideo: boolean;
  readonly publishDate: string | null;
  readonly image: EpisodeImage | null;
  readonly categoryName: string | null;
  readonly brandName: string | null;
}

export interface MediaAsset {
  readonly kind: 'audio' | 'video';
  readonly id: string;
  readonly title: string;
  /** Znormalizowany, publicznie dostępny URL (po nadpisaniu adresu VPN). */
  readonly url: string;
  /**
   * Adres, który przeglądarka nie odtworzy (MPEG-1 Layer II w `.wav`), gdy
   * `url` wskazuje na podmieniony wariant MP3. `null`, gdy nie było zamiany.
   */
  readonly sourceUri: string | null;
  readonly durationSeconds: number | null;
  readonly vttUrl: string | null;
  readonly isHls: boolean;
  readonly fileName: string | null;
}

export interface EpisodesPage {
  readonly episodes: readonly Episode[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export type MediaKindName = 'audio' | 'video';
