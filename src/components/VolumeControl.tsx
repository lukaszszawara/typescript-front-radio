'use client';

import { useId } from 'react';
import { VolumeHighIcon, VolumeMuteIcon } from './Icons';
import styles from './VolumeControl.module.css';

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

const MIN_STEP = 0.05;

export function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  const labelId = useId();
  const effective = muted ? 0 : volume;
  const level = effective < 0.34 ? 'low' : effective < 0.67 ? 'mid' : 'high';

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.muteButton}
        onClick={onToggleMute}
        aria-label={muted || volume === 0 ? 'Wyłącz dźwięk' : 'Wycisz'}
        aria-pressed={muted || volume === 0}
        title={muted || volume === 0 ? 'Wyłącz dźwięk' : 'Wycisz'}
      >
        {muted || volume === 0 ? <VolumeMuteIcon /> : <VolumeHighIcon />}
      </button>

      <div className={styles.sliderWrap} data-level={level}>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={1}
          step={MIN_STEP}
          value={effective}
          onChange={(event) => onVolumeChange(Number.parseFloat(event.target.value))}
          aria-labelledby={labelId}
          aria-valuetext={`Głośność ${Math.round(effective * 100)} procent`}
        />
      </div>
      <span className="sr-only" id={labelId}>
        Głośność
      </span>
    </div>
  );
}
