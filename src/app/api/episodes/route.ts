import { NextResponse } from 'next/server';
import { CmsError, fetchEpisodesPage } from '@/lib/cms';

export const revalidate = 300;

const MAX_PAGE_SIZE = 50;
const MAX_PAGE_NUMBER = 100_000;

function readInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Proxy do `GET /podcast-episodes/read-models`.
 * Dzięki niemu adres CMS i nadpisanie adresów VPN zostają po stronie serwera,
 * a klient rozmawia wyłącznie z własnym origin (bez problemów z CORS).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageNumber = readInt(url.searchParams.get('pageNumber'), 1, 1, MAX_PAGE_NUMBER);
  const pageSize = readInt(url.searchParams.get('pageSize'), 20, 1, MAX_PAGE_SIZE);

  try {
    const page = await fetchEpisodesPage(pageNumber, pageSize);
    return NextResponse.json(page, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    if (error instanceof CmsError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status === 404 ? 404 : 502 },
      );
    }

    return NextResponse.json(
      { error: 'Nieoczekiwany błąd podczas pobierania listy odcinków.' },
      { status: 500 },
    );
  }
}
