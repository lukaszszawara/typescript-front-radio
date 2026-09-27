'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EpisodeCard } from './EpisodeCard';
import { AlertIcon, SpinnerIcon } from './Icons';
import { usePlayer } from '@/hooks/usePlayer';
import type { Episode, EpisodesPage } from '@/lib/types';
import styles from './EpisodeList.module.css';

const PAGE_SIZE = 20;

interface EpisodeListProps {
  initialPage: EpisodesPage;
}

interface AppendState {
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

export function EpisodeList({ initialPage }: EpisodeListProps) {
  const [pages, setPages] = useState<EpisodesPage[]>([initialPage]);
  const [append, setAppend] = useState<AppendState>({ status: 'idle', error: null });
  const { episode: currentEpisode, engine, requestStatus } = usePlayer();

  const episodes = useMemo(() => {
    const seen = new Set<string>();
    const all: Episode[] = [];
    for (const page of pages) {
      for (const item of page.episodes) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        all.push(item);
      }
    }
    return all;
  }, [pages]);

  const loadedPages = pages.length;
  const total = pages[0]?.total ?? episodes.length;
  const totalPages = pages[0]?.totalPages ?? 1;
  const hasMore = loadedPages < totalPages && append.status !== 'loading';

  const loadMore = useCallback(async () => {
    setAppend({ status: 'loading', error: null });
    const nextPageNumber = loadedPages + 1;

    try {
      const response = await fetch(`/api/episodes?pageNumber=${nextPageNumber}&pageSize=${PAGE_SIZE}`);
      const payload = (await response.json()) as EpisodesPage & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? `Nie udało się wczytać kolejnej strony (HTTP ${response.status}).`);
      }

      setPages((current) => [...current, payload]);
      setAppend({ status: 'idle', error: null });
    } catch (error) {
      setAppend({
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Nie udało się wczytać kolejnej strony odcinków.',
      });
    }
  }, [loadedPages]);

  // Jesteśmy na końcu listy — nie zostawiamy użytkownika z „martwym” przyciskiem.
  useEffect(() => {
    document.title = `Podcasty Polskiego Radia — ${total} odcinków`;
  }, [total]);

  return (
    <section className={styles.section} aria-labelledby="episode-list-heading">
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading} id="episode-list-heading">
            Odcinki podcastów
          </h1>
          <p className={styles.subheading}>
            Wybierz odcinek i odsłuchaj go lub obejrzyj. Tytuł odcinka prowadzi na stronę
            Polskiego Radia.
          </p>
        </div>
        <p className={styles.counter} aria-live="polite">
          {episodes.length > 0 ? `Załadowano ${episodes.length} z ${total} odcinków` : null}
        </p>
      </header>

      {episodes.length === 0 ? (
        <p className={styles.empty}>API nie zwróciło żadnych odcinków.</p>
      ) : (
        <ul className={styles.list}>
          {episodes.map((episode, index) => {
            const isActive = currentEpisode?.id === episode.id;
            return (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                position={index + 1}
                isActive={isActive}
                isPlaying={isActive && engine.isPlaying}
                isLoading={isActive && requestStatus === 'loading'}
              />
            );
          })}
        </ul>
      )}

      <div className={styles.footer}>
        {append.status === 'error' ? (
          <p className={styles.error} role="alert">
            <AlertIcon width={16} height={16} />
            {append.error}
          </p>
        ) : null}

        {hasMore ? (
          <button
            type="button"
            className={styles.loadMore}
            onClick={() => void loadMore()}
            disabled={append.status === 'loading'}
          >
            {append.status === 'loading' ? (
              <>
                <SpinnerIcon width={18} height={18} />
                Wczytywanie…
              </>
            ) : (
              'Pokaż więcej odcinków'
            )}
          </button>
        ) : episodes.length > 0 ? (
          <p className={styles.end}>
            To wszystkie dostępne odcinki ({total}).
          </p>
        ) : null}
      </div>
    </section>
  );
}
