'use client';

import { Back15Icon, CaptionsIcon, Forward30Icon, PauseIcon, PlayIcon } from './Icons';
import styles from './TransportControls.module.css';

interface TransportControlsProps {
  isPlaying: boolean;
  isReady: boolean;
  captionsEnabled: boolean;
  hasCaptions: boolean;
  onTogglePlay: () => void;
  onSkip: (delta: number) => void;
  onToggleCaptions: () => void;
}

export function TransportControls({
  isPlaying,
  isReady,
  captionsEnabled,
  hasCaptions,
  onTogglePlay,
  onSkip,
  onToggleCaptions,
}: TransportControlsProps) {
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.skipButton}
        onClick={() => onSkip(-15)}
        disabled={!isReady}
        aria-label="Cofnij 15 sekund"
        title="Cofnij 15 sekund"
      >
        <Back15Icon />
      </button>

      <button
        type="button"
        className={styles.playButton}
        onClick={onTogglePlay}
        disabled={!isReady}
        aria-label={isPlaying ? 'Pauza' : 'Odtwórz'}
        aria-pressed={isPlaying}
        title={isPlaying ? 'Pauza (spacja)' : 'Odtwórz (spacja)'}
      >
        {isPlaying ? <PauseIcon width={24} height={24} /> : <PlayIcon width={24} height={24} />}
      </button>

      <button
        type="button"
        className={styles.skipButton}
        onClick={() => onSkip(30)}
        disabled={!isReady}
        aria-label="Przesuń 30 sekund do przodu"
        title="Przesuń 30 sekund do przodu"
      >
        <Forward30Icon />
      </button>

      <p className={styles.spacer} aria-hidden="true" />

      <button
        type="button"
        className={styles.captionsButton}
        onClick={onToggleCaptions}
        disabled={!hasCaptions}
        aria-pressed={captionsEnabled}
        aria-label={hasCaptions ? 'Przełącz napisy' : 'Brak napisów dla tego materiału'}
        title={hasCaptions ? 'Napisy (C)' : 'Brak napisów'}
      >
        <CaptionsIcon width={18} height={18} />
      </button>
    </div>
  );
}
