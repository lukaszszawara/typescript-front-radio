'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { SeekBar } from './SeekBar';
import { TransportControls } from './TransportControls';
import { VolumeControl } from './VolumeControl';
import { FormatSwitch } from './FormatSwitch';
import {
  AlertIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  SpinnerIcon,
} from './Icons';
import { pickDuration } from '@/lib/format';
import styles from './PlayerPanel.module.css';

/** Skrót klawiszowy: spacja = play/pause, K = cofnij, L = przewiń, C = napisy. */
function usePlayerHotkeys(enabled: boolean, actions: {
  togglePlay: () => void;
  skip: (delta: number) => void;
  toggleCaptions: () => void;
  hasCaptions: boolean;
}) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          actionsRef.current.togglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          actionsRef.current.skip(-15);
          break;
        case 'ArrowRight':
          event.preventDefault();
          actionsRef.current.skip(30);
          break;
        case 'c':
        case 'C':
          if (actionsRef.current.hasCaptions) {
            event.preventDefault();
            actionsRef.current.toggleCaptions();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

export function PlayerPanel() {
  const {
    episode,
    kind,
    asset,
    requestStatus,
    requestError,
    engine,
    canSwitchFormat,
    canPlayAudio,
    canPlayVideo,
    switchKind,
    retry,
    close,
  } = usePlayer();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  usePlayerHotkeys(episode !== null, {
    togglePlay: engine.togglePlay,
    skip: engine.skip,
    toggleCaptions: engine.toggleCaptions,
    hasCaptions: engine.hasCaptions,
  });

  const toggleFullscreen = useCallback(() => {
    const node = surfaceRef.current;
    if (!node) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void node.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (episode === null) setIsFullscreen(false);
  }, [episode]);

  if (episode === null) {
    return (
      <aside className={styles.panel} aria-label="Odtwarzacz">
        <div className={styles.empty}>
          <div className={styles.emptyBadge} aria-hidden="true">
            <PlayIconPlaceholder />
          </div>
          <h2 className={styles.emptyTitle}>Wybierz odcinek</h2>
          <p className={styles.emptyText}>
            Kliknij przycisk odtwarzania przy wybranym odcinku, aby załadować go tutaj.
          </p>
        </div>
      </aside>
    );
  }

  const isVideoActive = kind === 'video';
  const isBusy = requestStatus === 'loading';
  const hasFailure = requestStatus === 'error';
  const knownDuration =
    engine.duration > 0
      ? engine.duration
      : (asset?.durationSeconds ?? pickDuration(episode.audioDuration, episode.videoDuration, kind) ?? 0);

  return (
    <aside className={styles.panel} aria-label="Odtwarzacz" data-kind={kind}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.podcast}>{episode.podcastTitle}</p>
          <h2 className={styles.title}>{episode.title}</h2>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={close}
          aria-label="Zamknij odtwarzacz"
          title="Zamknij odtwarzacz"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        className={styles.surface}
        ref={surfaceRef}
        data-video={isVideoActive || undefined}
        data-fullscreen={isFullscreen || undefined}
      >
        {/*
          Oba elementy trzymamy zamontowane przez cały czas życia odtwarzacza.
          Dzięki temu przełączenie audio ↔ wideo nie robi remountu i nie gubi stanu.
          `src` ustawia efekt w useMediaElement tylko dla aktywnego formatu.
        */}
        <video
          ref={engine.videoRef}
          className={styles.video}
          data-kind="video"
          playsInline
          preload="metadata"
          controls={false}
          hidden={!isVideoActive}
          aria-label={`Wideo: ${episode.title}`}
          poster={isVideoActive ? (episode.image?.uri ?? undefined) : undefined}
        >
          {isVideoActive && engine.trackUrl ? (
            <track
              kind="subtitles"
              srcLang="pl"
              label="Polski"
              src={engine.trackUrl}
              default={false}
            />
          ) : null}
        </video>

        <audio
          ref={engine.audioRef}
          className={styles.audio}
          data-kind="audio"
          preload="metadata"
          controls={false}
          hidden={isVideoActive}
          aria-label={`Audio: ${episode.title}`}
        >
          {engine.trackUrl ? (
            <track kind="subtitles" srcLang="pl" label="Polski" src={engine.trackUrl} default={false} />
          ) : null}
        </audio>

        {!isVideoActive ? (
          <div className={styles.audioArt} aria-hidden="true">
            {episode.image ? (
              // Obraz z CDN dopuszczamy jawnie, bez next/image — tu liczy się brak
              // proxy i natychmiastowe pokazanie okładki.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={episode.image.uri} alt="" loading="lazy" decoding="async" />
            ) : (
              <div className={styles.audioArtFallback}>{episode.podcastTitle.slice(0, 2)}</div>
            )}
          </div>
        ) : null}

        {isBusy ? (
          <div className={styles.overlay} role="status">
            <SpinnerIcon width={32} height={32} />
            <p>Ładuję materiał…</p>
          </div>
        ) : null}

        {hasFailure ? (
          <div className={`${styles.overlay} ${styles.overlayError}`} role="alert">
            <AlertIcon width={28} height={28} />
            <p className={styles.errorTitle}>{engine.error?.title ?? 'Błąd odtwarzania'}</p>
            <p>{requestError ?? engine.error?.message ?? 'Nie udało się odtworzyć tego materiału.'}</p>
            {engine.error?.code === 4 && canPlayVideo ? (
              <p className={styles.errorHint}>
                Ten odcinek ma też wersję wideo — przełącz format powyżej.
              </p>
            ) : null}
            <button type="button" className={styles.retryButton} onClick={retry}>
              Spróbuj ponownie
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.controls}>
        <SeekBar
          currentTime={engine.currentTime}
          duration={knownDuration}
          buffered={engine.buffered}
          disabled={hasFailure}
          onSeek={engine.seek}
        />

        <div className={styles.secondaryRow}>
          <FormatSwitch
            kind={kind}
            canSwitch={canSwitchFormat}
            canPlayAudio={canPlayAudio}
            canPlayVideo={canPlayVideo}
            disabled={isBusy}
            onChange={switchKind}
          />

          {isVideoActive ? (
            <button
              type="button"
              className={styles.iconButton}
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}
              title={isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}
            >
              {isFullscreen ? (
                <CollapseIcon width={18} height={18} />
              ) : (
                <ExpandIcon width={18} height={18} />
              )}
            </button>
          ) : null}
        </div>

        <div className={styles.primaryRow}>
          <TransportControls
            isPlaying={engine.isPlaying}
            isReady={!hasFailure && !isBusy}
            captionsEnabled={engine.captionsEnabled}
            hasCaptions={engine.hasCaptions}
            onTogglePlay={engine.togglePlay}
            onSkip={engine.skip}
            onToggleCaptions={engine.toggleCaptions}
          />

          <VolumeControl
            volume={engine.volume}
            muted={engine.muted}
            onVolumeChange={engine.setVolume}
            onToggleMute={engine.toggleMute}
          />
        </div>

        {engine.playbackRate !== 1 ? (
          <button
            type="button"
            className={styles.rateBadge}
            onClick={engine.cyclePlaybackRate}
            aria-label={`Prędkość odtwarzania ${engine.playbackRate}×. Zmień prędkość.`}
          >
            {engine.playbackRate}×
          </button>
        ) : null}

        {engine.captionsEnabled && engine.activeCue ? (
          <p className={styles.cue} aria-live="off">
            {engine.activeCue}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function PlayIconPlaceholder() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.1-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}
