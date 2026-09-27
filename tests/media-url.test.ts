import { describe, expect, it } from 'vitest';
import { PUBLIC_CDN_BASE, isHlsUri, toPublicMediaUrl } from '@/lib/media-url';

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
