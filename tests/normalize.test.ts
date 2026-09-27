import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationLong, formatPublishDate, pickDuration } from '@/lib/format';
import { buildProductionEpisodeUrl } from '@/lib/episode-url';
import { normalizeEpisode, normalizeEpisodesPage, normalizeMediaAsset } from '@/lib/normalize';
import { PUBLIC_CDN_BASE } from '@/lib/media-url';
import type { CmsPodcastEpisode } from '@/lib/cms-types';

const baseEpisode: CmsPodcastEpisode = {
  id: 'e-1',
  title: 'Kiedy masz 20 lat i nie masz znajomych',
  slug: 'odcinek-123',
  podcastSlug: 'historia-opowiedziana',
  podcastTitle: 'Historia Opowiedziana',
  audioDuration: 1452,
  videoDuration: null,
  externalAudioId: '11111111-1111-1111-1111-111111111111',
  externalVideoId: null,
  hasAudio: true,
  hasVideo: false,
  publishDate: '2026-07-01T06:05:00+02:00',
  mainImage: { uri: 'https://cdn6.polskieradio.pl/cdn/dev/x/img.jpeg', title: 'okładka' },
};

describe('buildProductionEpisodeUrl', () => {
  it('buduje link na produkcję zgodnie ze wzorcem', () => {
    expect(
      buildProductionEpisodeUrl('historia-opowiedziana', 'odcinek-123', 'https://www.polskieradio.pl'),
    ).toBe('https://www.polskieradio.pl/podcasty/historia-opowiedziana/odcinek-123');
  });

  it('radzi sobie z ukośnikiem na końcu base URL', () => {
    expect(buildProductionEpisodeUrl('a', 'b', 'https://www.polskieradio.pl/')).toBe(
      'https://www.polskieradio.pl/podcasty/a/b',
    );
  });

  it('zwraca null, gdy brakuje slugów', () => {
    expect(buildProductionEpisodeUrl(null, 'b')).toBeNull();
    expect(buildProductionEpisodeUrl('a', null)).toBeNull();
    expect(buildProductionEpisodeUrl('  ', 'b')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formatuje minuty i sekundy', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(1452)).toBe('24:12');
  });

  it('dodaje godziny dopiero powyżej 60 minut', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(4636)).toBe('1:17:16');
  });

  it('obsługuje wartości niepoprawne', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(-5)).toBe('—');
  });
});

describe('formatDurationLong', () => {
  it('tworzy opis słowny', () => {
    expect(formatDurationLong(1452)).toBe('24 min 12 s');
    expect(formatDurationLong(3600)).toBe('1 godz.');
    expect(formatDurationLong(3601)).toBe('1 godz. 1 s');
    expect(formatDurationLong(0)).toBe('0 s');
  });
});

describe('formatPublishDate', () => {
  it('formatuje datę po polsku', () => {
    expect(formatPublishDate('2026-07-01T06:05:00+02:00')).toBe('1 lipca 2026');
  });

  it('zwraca null dla pustych i błędnych dat', () => {
    expect(formatPublishDate(null)).toBeNull();
    expect(formatPublishDate('nie-data')).toBeNull();
  });
});

describe('pickDuration', () => {
  it('preferuje format zgodny z wyborem i ma fallback', () => {
    expect(pickDuration(100, 200, 'video')).toBe(200);
    expect(pickDuration(100, null, 'video')).toBe(100);
    expect(pickDuration(100, 200, 'audio')).toBe(100);
  });
});

describe('normalizeEpisode', () => {
  it('mapuje odcinek z read-modelu', () => {
    const episode = normalizeEpisode(baseEpisode);

    expect(episode.id).toBe('e-1');
    expect(episode.productionUrl).toBe(
      'https://www.polskieradio.pl/podcasty/historia-opowiedziana/odcinek-123',
    );
    expect(episode.hasAudio).toBe(true);
    expect(episode.hasVideo).toBe(false);
    expect(episode.externalAudioId).toBe('11111111-1111-1111-1111-111111111111');
    expect(episode.image?.uri).toBe('https://cdn6.polskieradio.pl/cdn/dev/x/img.jpeg');
  });

  it('wypytywa flagę formatu, gdy brak identyfikatora', () => {
    const episode = normalizeEpisode({
      ...baseEpisode,
      externalVideoId: null,
      hasVideo: true,
    });

    // `hasVideo` z API bez identyfikatora nie pozwala odtworzyć — traktujemy jako brak.
    expect(episode.hasVideo).toBe(false);
  });

  it('wyznacza dostępność mediów na podstawie identyfikatorów', () => {
    const episode = normalizeEpisode({ ...baseEpisode, hasAudio: undefined, hasVideo: undefined });
    expect(episode.hasAudio).toBe(true);
    expect(episode.hasVideo).toBe(false);
  });

  it('zastępuje brakujące wartości czytelnymi placeholderami', () => {
    const episode = normalizeEpisode({
      id: 'e-2',
      title: '   ',
      podcastTitle: null,
    });

    expect(episode.title).toBe('Bez tytułu');
    expect(episode.podcastTitle).toBe('Nieznany podcast');
    expect(episode.productionUrl).toBeNull();
    expect(episode.image).toBeNull();
  });
});

describe('normalizeEpisodesPage', () => {
  it('zachowuje metadane paginacji', () => {
    const page = normalizeEpisodesPage({
      data: [baseEpisode],
      total: 82570,
      pageNumber: 2,
      pageSize: 20,
      totalPages: 4129,
    });

    expect(page.episodes).toHaveLength(1);
    expect(page.pageNumber).toBe(2);
    expect(page.total).toBe(82570);
    expect(page.totalPages).toBe(4129);
  });

  it('obsługuje pustą listę (strona poza zakresem)', () => {
    const page = normalizeEpisodesPage({
      data: null,
      total: 82570,
      pageNumber: 999999,
      pageSize: 10,
      totalPages: 8257,
    });

    expect(page.episodes).toEqual([]);
  });
});

describe('normalizeMediaAsset', () => {
  it('buduje asset z publicznym URL-em', () => {
    const asset = normalizeMediaAsset(
      {
        id: 'm-1',
        title: 'Materiał',
        fileName: 'x.mp4',
        uri: 'https://cdn6.polskieradio.pl/cms/dev/video/all/m-1/video.mp4',
        durationSeconds: 120,
        transcription: {
          vttUri: 'https://cdn6.polskieradio.pl/cms/dev/video/all/m-1/transcription.vtt',
        },
      },
      'video',
    );

    expect(asset).not.toBeNull();
    expect(asset?.url).toBe('https://cdn6.polskieradio.pl/cms/dev/video/all/m-1/video.mp4');
    expect(asset?.kind).toBe('video');
    expect(asset?.isHls).toBe(false);
    expect(asset?.vttUrl).toBe(
      'https://cdn6.polskieradio.pl/cms/dev/video/all/m-1/transcription.vtt',
    );
  });

  it('nadpisuje adres za VPN-em również dla napisów', () => {
    const asset = normalizeMediaAsset(
      {
        id: 'm-2',
        uri: 'https://dev-cms-gateway.polskieradio.pl/~~/portalfs.prsa.pl/a.wav',
        durationSeconds: 10,
        transcription: { vttUri: 'https://dev-cms-gateway.polskieradio.pl/~~/portalfs.prsa.pl/a.vtt' },
      },
      'audio',
    );

    expect(asset?.url).toBe(`${PUBLIC_CDN_BASE}/portalfs.prsa.pl/a.wav`);
    expect(asset?.vttUrl).toBe(`${PUBLIC_CDN_BASE}/portalfs.prsa.pl/a.vtt`);
  });

  it('wykrywa strumień HLS', () => {
    const asset = normalizeMediaAsset(
      { id: 'm-3', uri: 'https://cdn6.polskieradio.pl/live/stream.m3u8' },
      'video',
    );
    expect(asset?.isHls).toBe(true);
  });

  it('używa czasu trwania z odcinka, gdy API go nie zwraca', () => {
    const asset = normalizeMediaAsset(
      { id: 'm-4', uri: 'https://cdn6.polskieradio.pl/a.wav', durationSeconds: null },
      'audio',
      1452,
    );
    expect(asset?.durationSeconds).toBe(1452);
  });

  it('zwraca null, gdy brak publicznie dostępnego uri', () => {
    expect(
      normalizeMediaAsset({ id: 'm-5', uri: 'https://dev-cms-gateway.polskieradio.pl/~~' }, 'audio'),
    ).toBeNull();
    expect(normalizeMediaAsset({ id: 'm-6' }, 'audio')).toBeNull();
  });
});
