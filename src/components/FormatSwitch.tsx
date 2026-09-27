'use client';

import { FilmIcon, HeadphonesIcon } from './Icons';
import type { MediaKindName } from '@/lib/types';
import styles from './FormatSwitch.module.css';

interface FormatSwitchProps {
  kind: MediaKindName;
  canSwitch: boolean;
  canPlayAudio: boolean;
  canPlayVideo: boolean;
  disabled?: boolean;
  onChange: (kind: MediaKindName) => void;
}

/**
 * Przełącznik audio ↔ wideo. Gdy odcinek ma tylko jeden format,
 * pokazujemy nieaktywny stan zamiast ukrywać kontrolkę (a11y + UX).
 */
export function FormatSwitch({
  kind,
  canSwitch,
  canPlayAudio,
  canPlayVideo,
  disabled = false,
  onChange,
}: FormatSwitchProps) {
  const showVideo = canPlayVideo || canSwitch;
  const showAudio = canPlayAudio || canSwitch;

  if (!showVideo && !showAudio) {
    return (
      <p className={styles.none} role="status">
        Ten odcinek nie ma dostępnej wersji audio ani wideo.
      </p>
    );
  }

  return (
    <div
      className={styles.group}
      role="radiogroup"
      aria-label="Format odtwarzania"
      data-can-switch={canSwitch || undefined}
    >
      {showVideo ? (
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'video'}
          className={styles.option}
          disabled={disabled || !canPlayVideo}
          onClick={() => onChange('video')}
          title={canPlayVideo ? 'Odtwarzaj wersję wideo' : 'Brak wersji wideo'}
        >
          <FilmIcon width={16} height={16} />
          <span>Wideo</span>
        </button>
      ) : null}

      {showAudio ? (
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'audio'}
          className={styles.option}
          disabled={disabled || !canPlayAudio}
          onClick={() => onChange('audio')}
          title={canPlayAudio ? 'Odtwarzaj wersję audio' : 'Brak wersji audio'}
        >
          <HeadphonesIcon width={16} height={16} />
          <span>Audio</span>
        </button>
      ) : null}
    </div>
  );
}
