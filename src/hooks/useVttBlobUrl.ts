'use client';

import { useEffect, useState } from 'react';

/**
 * Polskie Radio udostępnia pliki WebVTT jako `application/octet-stream`
 * z nagłówkiem `nosniff`, przez co przeglądarki odrzucają je przy
 * bezpośrednim podpięciu do `<track>` (0 cue'ów + błąd w konsoli).
 *
 * Pobieramy więc napisy jako tekst i podpinamy jako `blob:` z poprawnym
 * typem `text/vtt`. Dzięki temu napisy działają niezależnie od nagłówków CDN.
 */
export function useVttBlobUrl(vttUrl: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (vttUrl === null || vttUrl === '') {
      setBlobUrl(null);
      return;
    }

    const controller = new AbortController();
    let createdUrl: string | null = null;
    setBlobUrl(null);

    fetch(vttUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (controller.signal.aborted) return;
        createdUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
        setBlobUrl(createdUrl);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Nie udało się pobrać napisów:', error);
      });

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [vttUrl]);

  return blobUrl;
}
