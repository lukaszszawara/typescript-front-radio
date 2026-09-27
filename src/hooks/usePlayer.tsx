'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMediaElement, type MediaElementApi, type PlayerError } from './useMediaElement';
import { useVttBlobUrl } from './useVttBlobUrl';
import type { Episode, MediaAsset, MediaKindName } from '@/lib/types';
import { pickDuration } from '@/lib/format';

export type MediaRequestStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PlayerContextValue {
  episode: Episode | null;
  kind: MediaKindName;
  asset: MediaAsset | null;
  requestStatus: MediaRequestStatus;
  requestError: string | null;
  engine: MediaElementApi;
  /** Czy odcinek ma oba formaty — steruje przełącznikiem audio ↔ wideo. */
  canSwitchFormat: boolean;
  canPlayAudio: boolean;
  canPlayVideo: boolean;
  selectEpisode: (episode: Episode, kind?: MediaKindName) => void;
  toggleEpisode: (episode: Episode) => void;
  switchKind: (kind: MediaKindName) => void;
  /** Ponawia pobranie assetu i podpięcie źródła, zachowując pozycję. */
  retry: () => void;
  close: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function defaultKindFor(episode: Episode, preferred: MediaKindName): MediaKindName {
  if (preferred === 'video' && episode.hasVideo) return 'video';
  if (preferred === 'audio' && episode.hasAudio) return 'audio';
  if (episode.hasVideo) return 'video';
  if (episode.hasAudio) return 'audio';
  // Odcinek bez mediów — i tak nic nie odtworzymy, ale jakoś trzeba nazwać format.
  return preferred;
}

function mediaIdFor(episode: Episode, kind: MediaKindName): string | null {
  return kind === 'video' ? episode.externalVideoId : episode.externalAudioId;
}

async function fetchAsset(
  kind: MediaKindName,
  id: string,
  duration: number | null,
  signal: AbortSignal,
): Promise<MediaAsset> {
  const params = new URLSearchParams();
  if (duration != null) params.set('duration', String(Math.round(duration)));

  const response = await fetch(`/api/media/${kind}/${id}?${params.toString()}`, { signal });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Nie udało się pobrać materiału (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object' || !('url' in payload)) {
    throw new Error('API zwróciło nieprawidłową odpowiedź.');
  }

  return payload as MediaAsset;
}

export function PlayerProvider({
  children,
  initialEpisode = null,
}: {
  children: ReactNode;
  initialEpisode?: Episode | null;
}) {
  const [episode, setEpisode] = useState<Episode | null>(initialEpisode);
  const [kind, setKind] = useState<MediaKindName>('video');
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [requestStatus, setRequestStatus] = useState<MediaRequestStatus>('idle');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [preferredKind, setPreferredKind] = useState<MediaKindName>('video');
  const [assetToken, setAssetToken] = useState(0);

  const handleEngineError = useCallback((error: PlayerError) => {
    setRequestError(error.message);
    setRequestStatus('error');
  }, []);

  // CDN podaje WebVTT jako `application/octet-stream` + `nosniff`, więc
  // `<track src>` nie zadziała — pobieramy napisy i podpinamy jako blob.
  const trackUrl = useVttBlobUrl(asset?.vttUrl ?? null);

  const engine = useMediaElement({
    asset,
    autoplay,
    trackUrl,
    onError: handleEngineError,
  });

  // ---- ładowanie assetu -------------------------------------------------
  useEffect(() => {
    if (episode === null) {
      setAsset(null);
      setRequestStatus('idle');
      setRequestError(null);
      return;
    }

    const mediaId = mediaIdFor(episode, kind);
    if (mediaId === null) {
      setAsset(null);
      setRequestStatus('error');
      setRequestError(
        `Ten odcinek nie ma wersji ${kind === 'video' ? 'wideo' : 'audio'} w bazie Polskiego Radia.`,
      );
      return;
    }

    const controller = new AbortController();
    setRequestStatus('loading');
    setRequestError(null);

    fetchAsset(kind, mediaId, pickDuration(episode.audioDuration, episode.videoDuration, kind), controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setAsset(next);
        setRequestStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAsset(null);
        setRequestStatus('error');
        setRequestError(
          error instanceof Error
            ? error.message
            : 'Nie udało się pobrać materiału audio/wideo.',
        );
      });

    return () => controller.abort();
  }, [episode, kind, assetToken]);

  // Odcinek i pozycję z ostatniego odtworzenia obsługuje `useMediaElement`
  // (start zawsze od zera, chyba że to świadome przełączenie formatu).
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const selectEpisode = useCallback(
    (next: Episode, nextKind?: MediaKindName) => {
      const target = nextKind ?? defaultKindFor(next, preferredKind);
      setPreferredKind(target);
      setAutoplay(true);
      setEpisode(next);
      setKind(target);
    },
    [preferredKind],
  );

  const toggleEpisode = useCallback(
    (next: Episode) => {
      if (episode?.id === next.id && asset !== null) {
        engineRef.current.togglePlay();
        return;
      }
      const target = defaultKindFor(next, preferredKind);
      setPreferredKind(target);
      setAutoplay(true);
      setEpisode(next);
      setKind(target);
    },
    [episode?.id, asset, preferredKind],
  );

  const switchKind = useCallback(
    (next: MediaKindName) => {
      if (next === kind) return;
      // Przenosimy pozycję z jednego formatu na drugi — to ta sama treść.
      engineRef.current.startAt(engineRef.current.currentTime);
      setAutoplay(engineRef.current.isPlaying);
      setPreferredKind(next);
      setKind(next);
    },
    [kind],
  );

  const retry = useCallback(() => {
    if (episode === null) return;
    engineRef.current.startAt(engineRef.current.currentTime);
    setAssetToken((token) => token + 1);
  }, [episode]);

  const close = useCallback(() => {
    engineRef.current.close();
    setEpisode(null);
    setAsset(null);
    setRequestStatus('idle');
    setRequestError(null);
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      episode,
      kind,
      asset,
      requestStatus,
      requestError,
      engine,
      canSwitchFormat: Boolean(episode?.hasAudio && episode?.hasVideo),
      canPlayAudio: Boolean(episode?.hasAudio),
      canPlayVideo: Boolean(episode?.hasVideo),
      selectEpisode,
      toggleEpisode,
      switchKind,
      retry,
      close,
    }),
    [
      episode,
      kind,
      asset,
      requestStatus,
      requestError,
      engine,
      selectEpisode,
      toggleEpisode,
      switchKind,
      retry,
      close,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (context === null) {
    throw new Error('usePlayer musi być użyty wewnątrz <PlayerProvider>.');
  }
  return context;
}
