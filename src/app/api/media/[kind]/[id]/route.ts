import { NextResponse } from 'next/server';
import { CmsError, fetchMediaAsset } from '@/lib/cms';
import { resolvePlayableAudioUrl } from '@/lib/media-url';
import type { MediaAsset, MediaKindName } from '@/lib/types';

export const revalidate = 3600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMediaKind(value: string): value is MediaKindName {
  return value === 'audio' || value === 'video';
}

function readInt(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Nagrania w `.wav` bywają zakodowane w MPEG-1 Layer II, którego żadna
 * przeglądarka nie odtworzy. Dla audio sprawdzamy HEAD-em, czy CDN trzyma
 * obok wariant `.mp3` o tym samym czasie trwania, i podmieniamy URL.
 * Wideo nie ma wariantu alternatywnego, więc jest pomijane.
 */
async function playableOverride(
  kind: MediaKindName,
  asset: MediaAsset,
): Promise<{ url: string; sourceUri: string | null }> {
  if (kind !== 'audio') return { url: asset.url, sourceUri: null };

  const resolved = await resolvePlayableAudioUrl(asset.url);
  return { url: resolved.url ?? asset.url, sourceUri: resolved.sourceUri };
}

/**
 * Proxy do `GET /audio/{externalAudioId}` oraz `GET /video/{externalVideoId}`.
 * Zwraca znormalizowany asset z publicznym `url` (bez adresów „za VPN-em”).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await context.params;

  if (!isMediaKind(kind)) {
    return NextResponse.json({ error: 'Nieobsługiwany typ mediów.' }, { status: 404 });
  }

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: 'Nieprawidłowy identyfikator mediów — oczekiwano UUID.' },
      { status: 400 },
    );
  }

  const fallbackDuration = readInt(new URL(request.url).searchParams.get('duration'));

  try {
    const asset = await fetchMediaAsset(kind, id, fallbackDuration);

    if (asset === null) {
      return NextResponse.json(
        {
          error:
            'API nie udostępnia publicznego adresu tego materiału — odcinek prawdopodobnie wymaga dostępu z wewnątrz sieci Polskiego Radia.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ...asset, ...(await playableOverride(kind, asset)) },
      { headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    if (error instanceof CmsError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status === 404 ? 404 : 502 },
      );
    }

    return NextResponse.json(
      { error: 'Nieoczekiwany błąd podczas pobierania materiału.' },
      { status: 500 },
    );
  }
}
