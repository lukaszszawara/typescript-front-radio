'use client';

import { memo } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { FilmIcon, HeadphonesIcon, PlayIcon, PauseIcon, SpinnerIcon } from './Icons';
import { formatDuration, formatPublishDate } from '@/lib/format';
import type { Episode } from '@/lib/types';
import styles from './EpisodeCard.module.css';

interface EpisodeCardProps {
  episode: Episode;
  /** Pozycja na liście — używana tylko w komunikatach a11y. */
  position: number;
  isActive: boolean;
  isPlaying: boolean;
  isLoading: boolean;
}

function EpisodeCardComponent({
  episode,
  position,
  isActive,
  isPlaying,
  isLoading,
}: EpisodeCardProps) {
  const { toggleEpisode, selectEpisode } = usePlayer();

  const hasMedia = episode.hasAudio || episode.hasVideo;
  const duration =
    episode.videoDuration ?? episode.audioDuration ?? null;
  const publishDate = formatPublishDate(episode.publishDate);
  const meta = [episode.podcastTitle, duration != null ? formatDuration(duration) : null]
    .filter(Boolean)
    .join(' · ');

  const playLabel = isActive
    ? isPlaying
      ? `Wstrzymaj: ${episode.title}`
      : `Odtwórz: ${episode.title}`
    : `Odtwórz: ${episode.title}`;

  return (
    <li className={styles.card} data-active={isActive || undefined}>
      <div className={styles.thumbWrap}>
        {episode.image ? (
          // CDN dopuszcza hotlink i CORS; next/image tylko dodałoby proxy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.thumb}
            src={episode.image.uri}
            alt=""
            loading={position > 4 ? 'lazy' : 'eager'}
            decoding="async"
          />
        ) : (
          <div className={styles.thumbFallback} aria-hidden="true">
            {episode.podcastTitle.slice(0, 2)}
          </div>
        )}

        <button
          type="button"
          className={styles.playButton}
          onClick={() => (isActive ? toggleEpisode(episode) : selectEpisode(episode))}
          disabled={!hasMedia}
          aria-label={hasMedia ? playLabel : `Brak mediów: ${episode.title}`}
          title={hasMedia ? playLabel : 'Ten odcinek nie ma dostępnych mediów'}
        >
          {isActive && isLoading ? (
            <SpinnerIcon width={22} height={22} />
          ) : isActive && isPlaying ? (
            <PauseIcon width={22} height={22} />
          ) : (
            <PlayIcon width={22} height={22} />
          )}
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.podcast}>{episode.podcastTitle}</p>

        <h3 className={styles.title}>
          {episode.productionUrl ? (
            // Tytuł prowadzi na produkcyjną stronę odcinka — własnej podstrony
            // świadomie nie budujemy.
            <a
              className={styles.titleLink}
              href={episode.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {episode.title}
              <span className={styles.externalHint} aria-hidden="true">
                ↗
              </span>
              <span className="sr-only"> (otwiera stronę odcinka na polskieradio.pl)</span>
            </a>
          ) : (
            <span className={styles.titleLink}>{episode.title}</span>
          )}
        </h3>

        {episode.description ? <p className={styles.description}>{episode.description}</p> : null}

        <div className={styles.metaRow}>
          <ul className={styles.badges}>
            {episode.hasVideo ? (
              <li className={styles.badge}>
                <FilmIcon width={14} height={14} />
                Wideo
              </li>
            ) : null}
            {episode.hasAudio ? (
              <li className={styles.badge}>
                <HeadphonesIcon width={14} height={14} />
                Audio
              </li>
            ) : null}
            {!hasMedia ? <li className={`${styles.badge} ${styles.badgeMuted}`}>Brak mediów</li> : null}
            {episode.hasVideo && episode.hasAudio ? (
              <li className={`${styles.badge} ${styles.badgeAccent}`}>Audio + wideo</li>
            ) : null}
          </ul>

          <p className={styles.meta}>
            {meta}
            {publishDate ? ` · ${publishDate}` : ''}
          </p>
        </div>
      </div>
    </li>
  );
}

export const EpisodeCard = memo(EpisodeCardComponent);
