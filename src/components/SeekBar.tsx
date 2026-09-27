'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { formatDuration, formatDurationLong } from '@/lib/format';
import styles from './SeekBar.module.css';

interface SeekBarProps {
  currentTime: number;
  duration: number;
  buffered: number;
  disabled?: boolean;
  onSeek: (time: number) => void;
}

/**
 * Własny pasek postępu — świadomie bez natywnego `controls`.
 * `input[type=range]` daje nam za darmo pełną obsługę klawiatury i a11y
 * (role=slider, strzałki/Home/End), a warstwa wizualna robi resztę.
 *
 * Seeku nie robimy przy każdym `input` (przeciąganie generowałoby lawinę
 * żądań Range), tylko na „puszczeniu" suwaka / puszczeniu klawisza.
 * Aktualną wartość czytamy z refa, a nie ze stanu — inaczej w obrębie
 * jednego zadania wsadowego React nie zdążyłby jej przeliczyć i closure
 * widziałby poprzednią pozycję.
 */
export function SeekBar({
  currentTime,
  duration,
  buffered,
  disabled = false,
  onSeek,
}: SeekBarProps) {
  const labelId = useId();
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const scrubValueRef = useRef(0);
  const isScrubbingRef = useRef(false);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const displayed = isScrubbing ? scrubValue : currentTime;
  const playedRatio = safeDuration > 0 ? Math.min(1, Math.max(0, displayed / safeDuration)) : 0;
  const bufferedRatio = safeDuration > 0 ? Math.min(1, Math.max(0, buffered)) : 0;

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(event.target.value);
    scrubValueRef.current = value;
    setScrubValue(value);
  }, []);

  const beginScrub = useCallback(() => {
    scrubValueRef.current = currentTime;
    setScrubValue(currentTime);
    isScrubbingRef.current = true;
    setIsScrubbing(true);
  }, [currentTime]);

  // Commitujemy wyłącznie wtedy, gdy faktycznie trwało przeciąganie —
  // inaczej samo zdarzenie `blur` cofnęłoby pozycję na poprzednią.
  const commit = useCallback(() => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    onSeek(scrubValueRef.current);
  }, [onSeek]);

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.track}
        data-disabled={disabled || undefined}
        style={
          {
            '--played': `${playedRatio * 100}%`,
            '--buffered': `${bufferedRatio * 100}%`,
          } as React.CSSProperties
        }
      >
        <input
          className={styles.range}
          type="range"
          min={0}
          max={safeDuration > 0 ? safeDuration : 0}
          step={0.1}
          value={safeDuration > 0 ? displayed : 0}
          disabled={disabled || safeDuration === 0}
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={Math.round(safeDuration)}
          aria-valuenow={Math.round(displayed)}
          aria-valuetext={`${formatDuration(displayed)} z ${formatDuration(safeDuration)}`}
          onChange={handleChange}
          onPointerDown={beginScrub}
          onPointerUp={commit}
          onKeyDown={beginScrub}
          onKeyUp={commit}
          onBlur={commit}
        />
      </div>
      <p className={styles.times} id={labelId}>
        <span className={styles.current}>{formatDuration(displayed)}</span>
        <span className={styles.separator} aria-hidden="true">
          /
        </span>
        <span className={styles.total} title={formatDurationLong(safeDuration)}>
          {formatDuration(safeDuration)}
        </span>
      </p>
    </div>
  );
}
