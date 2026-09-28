import { describe, expect, it } from 'vitest';
import {
  PUBLIC_CDN_BASE,
  isHlsUri,
  resolvePlayableAudioUrl,
  toMp3SiblingUrl,
  toPublicMediaUrl,
} from '@/lib/media-url';

describe('toPublicMediaUrl', () => {
  it('zostawia bez zmian adresy już publiczne', () => {
    const input = 'https://cdn6.polskieradio.pl/cms/dev/audio/all/abc/audio.wav';
    expect(toPublicMediaUrl(input)).toBe(input);
  });

  it('nadpisuje adres za VPN-em na publiczny CDN', () => {
    const input =
      'https://dev-cms-gateway.polskieradio.pl/~~/portalfs.prsa.pl/UploadFiles$/cms/dev/audio/all/abc/audio.wav';

    expect(toPublicMediaUrl(input)).toBe(
      `${PUBLIC_CDN_BASE}/portalfs.prsa.pl/UploadFiles$/cms/dev/audio/all/abc/audio.wav`,
    );
  });

  it('nadpisuje adres, gdy marker ~~ występuje na hoście CDN', () => {
    const input = 'https://cdn6.polskieradio.pl/~~/portalfs.prsa.pl/x/video.mp4';
    expect(toPublicMediaUrl(input)).toBe(`${PUBLIC_CDN_BASE}/portalfs.prsa.pl/x/video.mp4`);
  });

  it('nie dubluje hosta CDN, jeśli występuje już w ścieżce', () => {
    const input =
      'https://dev-cms-gateway.polskieradio.pl/~~/cdn6.polskieradio.pl/cms/dev/video/all/abc/video.mp4';

    expect(toPublicMediaUrl(input)).toBe(`${PUBLIC_CDN_BASE}/cms/dev/video/all/abc/video.mp4`);
  });

  it('zachowuje query string i hash', () => {
    const input = 'https://dev-cms-gateway.polskieradio.pl/~~/portalfs.prsa.pl/a.wav?token=abc#t=10';
    expect(toPublicMediaUrl(input)).toBe(`${PUBLIC_CDN_BASE}/portalfs.prsa.pl/a.wav?token=abc#t=10`);
  });

  it('normalizuje powtórzone ukośniki w ścieżce', () => {
    const input = 'https://dev-cms-gateway.polskieradio.pl/~~//portalfs.prsa.pl//a.wav';
    expect(toPublicMediaUrl(input)).toBe(`${PUBLIC_CDN_BASE}/portalfs.prsa.pl/a.wav`);
  });

  it('zwraca null dla pustej ścieżki po markerze', () => {
    expect(toPublicMediaUrl('https://dev-cms-gateway.polskieradio.pl/~~')).toBeNull();
    expect(toPublicMediaUrl('https://dev-cms-gateway.polskieradio.pl/~~/')).toBeNull();
  });

  it('zwraca null dla danych niepoprawnych', () => {
    expect(toPublicMediaUrl(null)).toBeNull();
    expect(toPublicMediaUrl(undefined)).toBeNull();
    expect(toPublicMediaUrl('')).toBeNull();
    expect(toPublicMediaUrl('   ')).toBeNull();
    expect(toPublicMediaUrl('nie-url')).toBeNull();
    expect(toPublicMediaUrl('ftp://cdn6.polskieradio.pl/a.wav')).toBeNull();
  });
});

describe('isHlsUri', () => {
  it('rozpoznaje rozszerzenie .m3u8', () => {
    expect(isHlsUri('https://cdn6.polskieradio.pl/stream/index.m3u8')).toBe(true);
    expect(isHlsUri('https://cdn6.polskieradio.pl/stream/index.M3U8?token=x')).toBe(true);
  });

  it('odrzuca pliki progressive', () => {
    expect(isHlsUri('https://cdn6.polskieradio.pl/video.mp4')).toBe(false);
    expect(isHlsUri('https://cdn6.polskieradio.pl/audio.wav')).toBe(false);
    expect(isHlsUri(null)).toBe(false);
  });

  it('nie myli ścieżki zawierającej m3u8 w nazwie', () => {
    expect(isHlsUri('https://cdn6.polskieradio.pl/archiwum.m3u8/video.mp4')).toBe(false);
  });
});

describe('toMp3SiblingUrl', () => {
  it('zamienia rozszerzenie .wav na .mp3', () => {
    expect(
      toMp3SiblingUrl('https://cdn6.polskieradio.pl/cms/dev/audio/all/abc/audio.wav'),
    ).toBe('https://cdn6.polskieradio.pl/cms/dev/audio/all/abc/audio.mp3');
  });

  it('zachowuje query string i hash', () => {
    expect(
      toMp3SiblingUrl('https://cdn6.polskieradio.pl/x/audio.wav?token=abc#t=10'),
    ).toBe('https://cdn6.polskieradio.pl/x/audio.mp3?token=abc#t=10');
  });

  it('działa niezależnie od wielkości liter', () => {
    expect(toMp3SiblingUrl('https://cdn6.polskieradio.pl/x/AUDIO.WAV')).toBe(
      'https://cdn6.polskieradio.pl/x/AUDIO.mp3',
    );
  });

  it('nie rusza innych rozszerzeń', () => {
    expect(toMp3SiblingUrl('https://cdn6.polskieradio.pl/x/audio.mp3')).toBeNull();
    expect(toMp3SiblingUrl('https://cdn6.polskieradio.pl/x/video.mp4')).toBeNull();
    expect(toMp3SiblingUrl('https://cdn6.polskieradio.pl/x/stream.m3u8')).toBeNull();
  });

  it('nie myli ścieżki zawierającej .wav w nazwie katalogu', () => {
    expect(toMp3SiblingUrl('https://cdn6.polskieradio.pl/.wav/audio.mp3')).toBeNull();
  });

  it('odrzuca wartości puste', () => {
    expect(toMp3SiblingUrl(null)).toBeNull();
    expect(toMp3SiblingUrl(undefined)).toBeNull();
    expect(toMp3SiblingUrl('')).toBeNull();
    expect(toMp3SiblingUrl('   ')).toBeNull();
  });
});

describe('resolvePlayableAudioUrl', () => {
  it('podmienia .wav na .mp3, gdy wariant istnieje', async () => {
    const { url, sourceUri } = await resolvePlayableAudioUrl(
      'https://cdn6.polskieradio.pl/x/audio.wav',
      async () => true,
    );
    expect(url).toBe('https://cdn6.polskieradio.pl/x/audio.mp3');
    expect(sourceUri).toBe('https://cdn6.polskieradio.pl/x/audio.wav');
  });

  it('zostawia .wav, gdy wariantu mp3 brak', async () => {
    const { url, sourceUri } = await resolvePlayableAudioUrl(
      'https://cdn6.polskieradio.pl/x/audio.wav',
      async () => false,
    );
    expect(url).toBe('https://cdn6.polskieradio.pl/x/audio.wav');
    expect(sourceUri).toBeNull();
  });

  it('nie odpytuje CDN dla plików, które nie są .wav', async () => {
    let calls = 0;
    const probe = async () => {
      calls += 1;
      return true;
    };

    const mp3 = await resolvePlayableAudioUrl('https://cdn6.polskieradio.pl/x/audio.mp3', probe);
    const mp4 = await resolvePlayableAudioUrl('https://cdn6.polskieradio.pl/x/video.mp4', probe);
    const m3u8 = await resolvePlayableAudioUrl('https://cdn6.polskieradio.pl/x/s.m3u8', probe);

    expect(calls).toBe(0);
    expect(mp3.url).toBe('https://cdn6.polskieradio.pl/x/audio.mp3');
    expect(mp4.url).toBe('https://cdn6.polskieradio.pl/x/video.mp4');
    expect(m3u8.url).toBe('https://cdn6.polskieradio.pl/x/s.m3u8');
    expect(mp3.sourceUri).toBeNull();
  });

  it('zachowuje oryginał, gdy probe rzuci wyjątek', async () => {
    const { url, sourceUri } = await resolvePlayableAudioUrl(
      'https://cdn6.polskieradio.pl/x/audio.wav',
      async () => {
        throw new Error('sieć padła');
      },
    );

    expect(url).toBe('https://cdn6.polskieradio.pl/x/audio.wav');
    expect(sourceUri).toBeNull();
  });
});
