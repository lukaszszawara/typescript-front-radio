import { NextResponse } from 'next/server';
import { CmsError, fetchMediaAsset } from '@/lib/cms';
import type { MediaKindName } from '@/lib/types';

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

    return NextResponse.json(asset, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600' },
    });
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
