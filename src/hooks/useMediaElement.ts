'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { MediaAsset, MediaKindName } from '@/lib/types';

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlayerError {
  title: string;
  message: string;
  /** Kod z `MediaError` — pozwala dopasować podpowiedź w UI. */
  code?: number;
}

interface UseMediaElementOptions {
  asset: MediaAsset | null;
  /** Czy odtworzyć automatycznie po załadowaniu metadanych. */
  autoplay: boolean;
  /**
   * Gotowy do podpięcia adres napisów. Przekazujemy tu `blob:` z poprawnym
   * typem MIME — CDN podaje WebVTT jako `application/octet-stream`.
   */
  trackUrl: string | null;
  onEnded?: () => void;
  onError?: (error: PlayerError) => void;
}

export interface MediaElementApi {
  /** Obie `<audio>` i `<video>` trzymamy zamontowane — dzięki temu przełączenie
   *  formatu nie niszczy stanu odtwarzacza i nie powoduje remountu. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  status: PlayerStatus;
  error: PlayerError | null;
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  captionsEnabled: boolean;
  hasCaptions: boolean;
  activeCue: string | null;
  trackUrl: string | null;
  togglePlay: () => void;
  seek: (time: number) => void;
  skip: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  cyclePlaybackRate: () => void;
  toggleCaptions: () => void;
  close: () => void;
  /** Ustawia pozycję startową dla następnego załadowania (przełączenie formatu). */
  startAt: (time: number | null) => void;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

/** Które elementy mają zostać wyciszone (nieaktywny format). */
function isActiveElement(options: UseMediaElementOptions, element: HTMLMediaElement | null) {
  if (element === null) return false;
  return options.asset !== null && element.dataset.kind === options.asset.kind;
}

function describeMediaError(element: HTMLMediaElement, asset: MediaAsset | null): PlayerError {
  const code = element.error?.code;
  const isVideo = asset?.kind === 'video';

  switch (code) {
    case 1:
      return {
        title: 'Przerwano wczytywanie',
        message: 'Odtwarzanie zostało przerwane. Spróbuj ponownie.',
        code,
      };
    case 2:
      return {
        title: 'Błąd sieci',
        message: 'Nie udało się pobrać materiału — sprawdź połączenie i spróbuj ponownie.',
        code,
      };
    case 3:
      return {
        title: 'Błąd dekodowania',
        message: isVideo
          ? 'Przeglądarka nie potrafi odtworzyć tego pliku wideo.'
          : 'Przeglądarka nie potrafi odtworzyć tego pliku audio.',
        code,
      };
    case 4:
      return {
        title: 'Nieobsługiwany format',
        message:
          'Przeglądarka nie obsługuje kodeka tego pliku. Polskie Radio udostępnia część nagrań w formacie, którego przeglądarki nie odtwarzają.',
        code,
      };
    default:
      return {
        title: 'Błąd odtwarzania',
        message: 'Odtwarzanie nie powiodło się. Spróbuj ponownie lub przeładuj stronę.',
        code,
      };
  }
}

function readBufferedRatio(element: HTMLMediaElement): number {
  const duration = element.duration;
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  try {
    if (element.buffered.length === 0) return 0;
    const end = element.buffered.end(element.buffered.length - 1);
    return Math.min(1, Math.max(0, end / duration));
  } catch {
    return 0;
  }
}

/** Odczytuje aktualną ścieżkę tekstową z `<track>`. */
function readActiveCue(tracks: TextTrackList): string | null {
  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    if (!track || track.kind !== 'subtitles' || track.mode !== 'showing') continue;

    const active = track.activeCues;
    if (!active || active.length === 0) continue;

    const cue = active[0] as VTTCue | undefined;
    const text = cue?.text?.trim();
    if (text) return text;
  }
  return null;
}

export function useMediaElement(options: UseMediaElementOptions): MediaElementApi {
  const { asset } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState<PlayerError | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [activeCue, setActiveCue] = useState<string | null>(null);

  // Ustawienia survive'ują zmianę źródła, więc trzymamy je w refach —
  // dzięki temu efekt ładowania nie nadpisuje ich nowymi wartościami.
  const settingsRef = useRef({ volume, muted, playbackRate, captionsEnabled });
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Pozycja startowa kolejnego załadowania. Celowo poza `useEffect` deps:
   * efekt ma się wykonywać wyłącznie przy zmianie źródła / ponowieniu,
   * a nie przy każdym przerysowaniu (seek nie może resetować odtwarzania).
   */
  const startTimeRef = useRef<number | null>(null);

  const startAt = useCallback((time: number | null) => {
    startTimeRef.current = time;
  }, []);

  const activeElement = useCallback((): HTMLMediaElement | null => {
    if (optionsRef.current.asset === null) return null;
    return optionsRef.current.asset.kind === 'video' ? videoRef.current : audioRef.current;
  }, []);

  const inactiveElement = useCallback((): HTMLMediaElement | null => {
    if (optionsRef.current.asset === null) return null;
    return optionsRef.current.asset.kind === 'video' ? audioRef.current : videoRef.current;
  }, []);

  const close = useCallback(() => {
    const element = activeElement();
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setStatus('idle');
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setActiveCue(null);
  }, [activeElement]);

  // ---- ładowanie źródła -------------------------------------------------
  useEffect(() => {
    if (asset === null) {
      close();
      return;
    }

    const element = asset.kind === 'video' ? videoRef.current : audioRef.current;
    const other = asset.kind === 'video' ? audioRef.current : videoRef.current;

    // Drugo, nieaktywne ogniwo zawsze milczymy.
    if (other) {
      other.pause();
      other.removeAttribute('src');
      other.load();
    }

    if (element === null) return;

    // Pozycja startowa obowiązuje tylko to jedno załadowanie — inaczej
    // następny odcinek zacząłby w miejscu, w którym skończył poprzedni.
    const startTime = startTimeRef.current ?? 0;
    startTimeRef.current = null;

    setStatus('loading');
    setError(null);
    setActiveCue(null);
    setCurrentTime(startTime);

    hlsRef.current?.destroy();
    hlsRef.current = null;

    const cleanupFns: Array<() => void> = [];
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      // Nie cofamy pozycji, jeśli element jest już ustawiony (np. przy ponownym
      // `loadedmetadata` po seeku) — ustawiamy tylko wtedy, gdy jesteśmy za wcześnie.
      if (element.currentTime < startTime) {
        element.currentTime = startTime;
      }
      if (optionsRef.current.autoplay) {
        void element.play().catch(() => {
          // Autoplay zablokowany przeglądarką — zostawiamy stan pauzy.
          setIsPlaying(false);
        });
      }
    };

    const attachSource = async () => {
      if (asset.isHls) {
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hlsRef.current = hls;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else {
              hls.destroy();
              hlsRef.current = null;
              setStatus('error');
              setError({
                title: 'Błąd strumienia HLS',
                message: 'Nie udało się odtworzyć strumienia wideo.',
              });
            }
          });
          hls.loadSource(asset.url);
          hls.attachMedia(element);
          cleanupFns.push(() => {
            hls.destroy();
            if (hlsRef.current === hls) hlsRef.current = null;
          });
          return;
        }
        // Safari natywnie odtwarza HLS.
      }

      element.src = asset.url;
      element.load();
    };

    void attachSource();

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(element.duration) ? element.duration : 0);
      start();
      setStatus('ready');
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(element.currentTime);
      // `cuechange` nie bubble'uje w Chrome, a obiekt TextTrack bywa
      // podmieniany przy (re)ładowaniu ścieżki napisów. Aktualny cue
      // wyliczamy więc z `timeupdate`, który na pewno przychodzi.
      setActiveCue(readActiveCue(element.textTracks));
    };
    const onDurationChange = () =>
      setDuration(Number.isFinite(element.duration) ? element.duration : 0);
    const onProgress = () => setBuffered(readBufferedRatio(element));
    const onWaiting = () => setStatus((current) => (current === 'ready' ? 'ready' : current));
    const onEnded = () => {
      setIsPlaying(false);
      optionsRef.current.onEnded?.();
    };
    const onError = () => {
      if (element.error === null) return;
      setStatus('error');
      setError(describeMediaError(element, optionsRef.current.asset));
      setIsPlaying(false);
      optionsRef.current.onError?.(describeMediaError(element, optionsRef.current.asset));
    };
    const onVolumeChange = () => {
      setVolumeState(element.volume);
      setMuted(element.muted);
      settingsRef.current = { ...settingsRef.current, volume: element.volume, muted: element.muted };
    };
    const onRateChange = () => {
      setPlaybackRate(element.playbackRate);
      settingsRef.current = { ...settingsRef.current, playbackRate: element.playbackRate };
    };
    const onCueChange = () => setActiveCue(readActiveCue(element.textTracks));

    element.addEventListener('loadedmetadata', onLoadedMetadata);
    element.addEventListener('play', onPlay);
    element.addEventListener('playing', onPlay);
    element.addEventListener('pause', onPause);
    element.addEventListener('timeupdate', onTimeUpdate);
    element.addEventListener('durationchange', onDurationChange);
    element.addEventListener('progress', onProgress);
    element.addEventListener('waiting', onWaiting);
    element.addEventListener('ended', onEnded);
    element.addEventListener('error', onError);
    element.addEventListener('volumechange', onVolumeChange);
    element.addEventListener('ratechange', onRateChange);
    // `cuechange` wypala na TextTrack, ale bubbling prowadzi przez
    // TextTrackList do elementu multimedialnego. Nasłuch na elemencie
    // (a nie na konkretnym obiekcie TextTrack) przeżywa podmianę ścieżki
    // napisów, która następuje, gdy dociągnie blob z napisami.
    element.addEventListener('cuechange', onCueChange);

    for (const track of Array.from(element.textTracks)) {
      track.addEventListener('cuechange', onCueChange);
    }

    // Przywracamy ustawienia użytkownika dla nowego źródła.
    element.volume = settingsRef.current.volume;
    element.muted = settingsRef.current.muted;
    element.playbackRate = settingsRef.current.playbackRate;
    if (element.textTracks.length > 0) {
      element.textTracks[0]!.mode = settingsRef.current.captionsEnabled ? 'showing' : 'disabled';
    }

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
      element.removeEventListener('loadedmetadata', onLoadedMetadata);
      element.removeEventListener('play', onPlay);
      element.removeEventListener('playing', onPlay);
      element.removeEventListener('pause', onPause);
      element.removeEventListener('timeupdate', onTimeUpdate);
      element.removeEventListener('durationchange', onDurationChange);
      element.removeEventListener('progress', onProgress);
      element.removeEventListener('waiting', onWaiting);
      element.removeEventListener('ended', onEnded);
      element.removeEventListener('error', onError);
      element.removeEventListener('volumechange', onVolumeChange);
      element.removeEventListener('ratechange', onRateChange);
      element.removeEventListener('cuechange', onCueChange);
    };
  }, [asset, close]);

  // ---- kontrolki --------------------------------------------------------
  const togglePlay = useCallback(() => {
    const element = activeElement();
    if (!element || !isActiveElement(optionsRef.current, element)) return;
    if (element.paused || element.ended) void element.play().catch(() => setIsPlaying(false));
    else element.pause();
  }, [activeElement]);

  const seek = useCallback(
    (time: number) => {
      const element = activeElement();
      if (!element) return;
      const max = Number.isFinite(element.duration) ? element.duration : time;
      const next = Math.min(Math.max(time, 0), max);
      element.currentTime = next;
      setCurrentTime(next);
    },
    [activeElement],
  );

  const skip = useCallback((delta: number) => seek((activeElement()?.currentTime ?? 0) + delta), [
    activeElement,
    seek,
  ]);

  const setVolume = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), 1);
      settingsRef.current = { ...settingsRef.current, volume: clamped, muted: clamped === 0 };
      setVolumeState(clamped);
      setMuted(clamped === 0);
      for (const ref of [audioRef, videoRef]) {
        if (ref.current) {
          ref.current.volume = clamped;
          ref.current.muted = clamped === 0;
        }
      }
    },
    [],
  );

  const toggleMute = useCallback(() => {
    const next = !settingsRef.current.muted;
    settingsRef.current = { ...settingsRef.current, muted: next };
    setMuted(next);
    for (const ref of [audioRef, videoRef]) {
      if (ref.current) ref.current.muted = next;
    }
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const current = settingsRef.current.playbackRate;
    const index = PLAYBACK_RATES.indexOf(current as (typeof PLAYBACK_RATES)[number]);
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? 1;
    settingsRef.current = { ...settingsRef.current, playbackRate: next };
    setPlaybackRate(next);
    for (const ref of [audioRef, videoRef]) {
      if (ref.current) ref.current.playbackRate = next;
    }
  }, []);

  const hasCaptions = asset?.vttUrl != null;
  const trackUrl = options.trackUrl;

  // Napisy dociągają asynchronicznie (blob). Gdy się pojawią, ponawiamy
  // tryb wyświetlania — przeglądarka resetuje go przy (re)ładowaniu ścieżki.
  useEffect(() => {
    if (trackUrl === null) return;
    const element = activeElement();
    if (element === null) return;
    const track = element.textTracks[0];
    if (track) track.mode = settingsRef.current.captionsEnabled ? 'showing' : 'disabled';
  }, [trackUrl, activeElement]);

  const toggleCaptions = useCallback(() => {
    const next = !settingsRef.current.captionsEnabled;
    settingsRef.current = { ...settingsRef.current, captionsEnabled: next };
    setCaptionsEnabled(next);
    const element = activeElement();
    if (element) element.textTracks[0]!.mode = next ? 'showing' : 'disabled';
  }, [activeElement]);

  return useMemo(
    () => ({
      videoRef,
      audioRef,
      status,
      error,
      isPlaying,
      isReady: status === 'ready',
      currentTime,
      duration,
      buffered,
      volume,
      muted,
      playbackRate,
      captionsEnabled,
      hasCaptions,
      activeCue,
      trackUrl,
      togglePlay,
      seek,
      skip,
      setVolume,
      toggleMute,
      cyclePlaybackRate,
      toggleCaptions,
      close,
      startAt,
    }),
    [
      status,
      error,
      isPlaying,
      currentTime,
      duration,
      buffered,
      volume,
      muted,
      playbackRate,
      captionsEnabled,
      hasCaptions,
      activeCue,
      trackUrl,
      togglePlay,
      seek,
      skip,
      setVolume,
      toggleMute,
      cyclePlaybackRate,
      toggleCaptions,
      close,
      startAt,
    ],
  );
}

export type { MediaKindName };
