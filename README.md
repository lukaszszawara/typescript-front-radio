# pr-player-zadanie — własny player audio/wideo dla podcastów Polskiego Radia

Aplikacja webowa z listą odcinków podcastów i **własnym odtwarzaczem audio/wideo**
zbudowanym na natywnych elementach `<audio>` / `<video>` — bez `react-player`,
`video.js` czy `@mux/mux-player-react`.

Stack: **Next.js 16 (App Router) · TypeScript · pnpm · Node 24 · Docker (multi-stage, `output: 'standalone'`)**

---

## Odtworzenie repozytorium z bundle

Dostarczam historię commitów jako bundle:

```bash
git clone pr-player-zadanie_bundle.bundle pr-player-zadanie
cd pr-player-zadanie
corepack enable
pnpm install
pnpm dev
```

---

## Uruchomienie

### Lokalnie (Node 24)

```bash
corepack enable            # aktywuje pnpm wskazany w package.json
pnpm install
pnpm dev                   # http://localhost:3000
```

### Build produkcyjny

```bash
pnpm build
pnpm start                 # kopiuje statyczne zasoby i uruchamia .next/standalone/server.js
```

> `pnpm start` uruchamia ten sam kod co obraz Dockera. `next start` nie współpracuje
> z `output: 'standalone'`, dlatego drobnym wrapperem jest `scripts/start-standalone.mjs`.

### Docker

```bash
docker build -t pr-player-zadanie .
docker run --rm -p 3000:3000 pr-player-zadanie
```

Kontener startuje z `node server.js` jako użytkownik nieuprawniony (`nextjs`, uid 1001)
na Node 24. Weryfikacja:

```bash
curl http://localhost:3000/api/health    # {"status":"ok"}
```

### Konfiguracja

| Zmienna | Domyślnie | Rola |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://cms-gateway.polskieradio.pl/dev-proxy` | Adres brzegowy CMS |
| `API_BASE_URL` | — | Opcjonalne nadpisanie **wyłącznie po stronie serwera** (ma pierwszeństwo) |
| `NEXT_PUBLIC_SITE_URL` | `https://www.polskieradio.pl` | Baza linków do odcinków na produkcji |

```bash
cp .env.example .env.local
```

### Testy

```bash
pnpm test            # 32 testy jednostkowe (vitest)
pnpm typecheck
pnpm verify:player   # 27 sprawdzeń E2E w prawdziwej przeglądarce
```

`pnpm verify:player` wymaga działającej instancji aplikacji (`pnpm dev` albo `pnpm start`)
oraz Chromium — ścieżkę do pliku wykonawczego można nadpisać zmienną `CHROMIUM_PATH`.
Skrypt nie jest częścią obrazu Dockera; służy do weryfikacji przed oddaniem.

---

## Architektura

```
src/
├── app/
│   ├── layout.tsx                  # szkielet, metadane, skip-link
│   ├── page.tsx                    # RSC: SSR pierwszej strony + błąd API
│   ├── error.tsx / not-found.tsx   # stany awaryjne
│   └── api/
│       ├── episodes/route.ts               # GET → /podcast-episodes/read-models
│       ├── media/[kind]/[id]/route.ts      # GET → /audio/{id} | /video/{id}
│       └── health/route.ts                 # healthcheck
├── components/                     # EpisodeList, EpisodeCard, PlayerPanel, SeekBar, …
├── hooks/
│   ├── usePlayer.tsx               # Context: co odtwarzamy + lifecycle assetu
│   ├── useMediaElement.ts          # Silnik: natywny element multimedialny
│   └── useVttBlobUrl.ts            # Napisy → blob:text/vtt
└── lib/
    ├── cms.ts                      # Klient HTTP CMS (timeout, cache, mapowanie błędów)
    ├── cms-types.ts                # Kształt odpowiedzi API
    ├── normalize.ts                # API → typy domenowe
    ├── media-url.ts                # Nadpisanie adresów „za VPN-em”
    ├── episode-url.ts              # Link na produkcję polskieradio.pl
    └── format.ts                   # Czasy trwania, daty
```

### Przepływ danych

```
RSC (page.tsx) ──fetch──▶ lib/cms.ts ──▶ cms-gateway.polskieradio.pl
      │                        │
      │                        └─ normalizacja + nadpisanie adresów VPN
      ▼
<EpisodeList>  ──"pokaż więcej"──▶ /api/episodes
      │
      └──▶ /api/media/{audio|video}/{externalId} ──▶ lib/cms.ts ──▶ asset
                                                          │
        usePlayer ──▶ useMediaElement ──▶ <audio> / <video> + hls.js
```

**Klient nigdy nie rozmawia wprost z CMS.** Obie integracje przechodzą przez route
handlery, dzięki czemu:

- adres CMS i nadpisanie adresów VPN zostają po stronie serwera,
- klient nie potrzebuje obsługi CORS (choć CDN i tak wysyła `Access-Control-Allow-Origin: *`),
- mamy jedno miejsce na mapowanie błędów, timeout (12 s) i cache (`revalidate`).

Pierwsza strona listy renderowana jest na serwerze (natychmiastowy first paint + SEO),
kolejne strony dociągają klientowo z `/api/episodes` — „pokaż więcej" zamiast paginacji
z numerami, co przy `total: 82570` pozycji ma sens.

---

## Podjęte decyzje

### 1. Własny player na natywnych elementach

Jedno źródło prawdy: `useMediaElement` opakowuje `<audio>`/`<video>` i wystawia
gotowe kontrolki. Nie ma warstwy „wrappera playera” — hook sam zarządza
`src`, `currentTime`, `volume`, `playbackRate` i ścieżkami tekstowymi.

**Oba elementy (`<audio>` i `<video>`) są zamontowane przez cały czas życia odtwarzacza**,
a aktywny format dostaje `src`. Gdyby renderowanie było warunkowe (`kind === 'video' ? <video> : <audio>`),
każde przełączenie robiłoby remount i gubiło stan (pozycję, głośność, bufor).
Dzięki trzymaniu obu elementów przełączenie audio ↔ wideo jest natychmiastowe —
i **przenosi pozycję odtwarzania**, bo to ta sama treść.

### 2. Nadpisanie adresów „za VPN-em”

`uri` z API może wskazywać na zasób dostępny tylko wewnątrz sieci Polskiego Radia:

```
https://dev-cms-gateway.polskieradio.pl/~~/portalfs.prsa.pl/UploadFiles$/...
→ https://cdn6.polskieradio.pl/~/portalfs.prsa.pl/UploadFiles$/...
```

`toPublicMediaUrl()` obsługuje: adresy już publiczne (bez zmian), hosty `dev-*`,
marker `/~~` w ścieżce, zdublowany prefiks `cdn6.polskieradio.pl`, powtórzone
ukośniki oraz zachowanie query stringa i hasha. Ta sama funkcja przetwarza `uri`
napisów. Pokryta 11 testami jednostkowymi.

### 3. Rozwiązywanie sporu o formaty audio

Media w `dev-proxy` bywają w rozszerzeniu `.wav`, ale **wewnątrz używają Dolby AC-3**
(`audioFormat = 0x0050`), a nie PCM. Przeglądarki nie dekodują AC-3 w kontenerze WAV,
więc `<audio>` kończy się `MediaError` z kodem 4. Na 28 sprawdzonych assetach 25 to MP3
(odtwarzają się bez problemu), 2 to wspomniane WAV-y z AC-3.

Nie da się tego obejść po stronie aplikacji — API udostępnia wyłącznie `uri` tego
pliku (`availableFormats` bywa puste), a zmiana kodeka to zadanie dla CMS.
Player pokazuje wtedy konkretny komunikat („Nieobsługiwany format”) z podpowiedzią
przełączenia na wersję wideo, jeśli odcinek ją ma. Zmianę widać w logu
weryfikacyjnym: „nieobsługiwany kodek pokazuje czytelny błąd".

### 4. Napisy WebVTT przez `blob:`

CDN podaje pliki `.vtt` jako `application/octet-stream` z nagłówkiem
`X-Content-Type-Options: nosniff`. Przeglądarki odrzucają taką ścieżkę
(0 cue'ów + błąd „Unsafe attempt to load URL” w konsoli), mimo że CORS jest poprawne.

`useVttBlobUrl` pobiera napisy jako tekst i podpina `blob:` z typem `text/vtt`.
Po podmianie działa 578 cue'ów, a bieżący tekst wyświetla się pod paskiem postępu
(ważne przy formacie audio, gdzie nie ma obrazu do renderowania napisów).

Drobiazg, który kosztował godzinę: **`cuechange` nie bubble'uje w Chrome**, a obiekt
`TextTrack` bywa podmieniany przy ponownym załadowaniu ścieżki. Bieżący cue
wyliczamy więc z `timeupdate`, a nasłuch na elemencie traktujemy jako uzupełnienie.

### 5. Seek: jeden seek na „puszczenie”

Pasek postępu to `input[type=range]` pod własną warstwą wizualną — dzięki temu
strzałki/Home/End, `role=slider` i komunikaty czytników ekranu działają bez pisania
własnej obsługi klawiatury. `step={0.1}` daje płynne przewijanie.

Nie seekujemy przy każdym zdarzeniu `input` (przeciąganie nad plikiem 40 MB generowałoby
lawinę żądań Range), lecz na `pointerup` / `keyup` / `blur`. Aktualną wartość czytamy
z **refa, a nie ze stanu**: w obrębie jednego zadania wsadowego React nie zdąży
przeliczyć stanu, więc closure widziałby poprzednią pozycję i cofałoby odtwarzanie
przy każdym przeciągnięciu. Dodatkowo commitujemy tylko wtedy, gdy przeciąganie
faktycznie trwało — samo `blur` nie może cofnąć pozycji.

### 6. Stany (wymagane w zadaniu)

| Stan | Gdzie | Komunikat |
| --- | --- | --- |
| Ładowanie listy | RSC | Strona renderuje się po stronie serwera; brak „pustki” |
| Błąd API (lista) | `page.tsx` → `ListErrorState` | Tytuł, komunikat z API, podpowiedź o zmiennej env, przycisk „Spróbuj ponownie” |
| Błąd API (dalsze strony) | `EpisodeList` | Komunikat nad przyciskiem „Pokaż więcej”, przycisk zostaje aktywny |
| Brak mediów | `EpisodeCard` | Badge „Brak mediów”, przycisk play wyłączony, `aria-label` to wyjaśnia |
| Brak wersji formatu | `FormatSwitch` | Nieaktywny wariant zamiast znikającej kontrolki |
| Brak publicznego `uri` | `/api/media` → 404 | „Materiał wymaga dostępu z wewnątrz sieci Polskiego Radia” |
| Błąd odtwarzania | `PlayerPanel` | Nazwa błędu z `MediaError`, komunikat, „Spróbuj ponownie” (zachowuje pozycję) |
| Nieobsługiwany kodek | `PlayerPanel` | Podpowiedź przełączenia na wideo, jeśli istnieje |

### 7. Dostępność i responsywność

- Nawigacja klawiaturą: `spacja`/`K` play-pauza, `←`/`→` przewijanie, `C` napisy
  (ignorowane, gdy fokus jest w polu tekstowym).
- `aria-label` na każdej kontrolce, `aria-pressed` / `aria-checked` tam, gdzie to stan,
  `aria-valuetext` na pasku postępu („2:03 z 28:23”), skip-link do treści.
- Layout: desktop — lista + przyklejony panel w kolumnie bocznej; mobile — panel
  `fixed` na dole ekranu, z `env(safe-area-inset-bottom)` i bez poziomego scrolla
  (obie szerokości sprawdzone automatycznie).
- `prefers-reduced-motion` wyłącza animacje.

### 8. hls.js — przygotowane, nie aktywne

`isHlsUri()` wykrywa `.m3u8`, a `useMediaElement` dynamicznie importuje `hls.js`
tylko wtedy, gdy format naprawdę tego wymaga (Safari dostaje natywną ścieżkę).
W środowisku testowym API nie zwraca strumieni HLS, więc kod nie jest używany —
dlatego import jest dynamiczny, a biblioteka nie waży bundle'u na co dzień.
`hls.js` to biblioteka niskopoziomowa, więc mieści się w dozwolonym zakresie.

### 9. Drobiazgi świadomie pominięte

- `next/image` dla okładek: CDN dopuszcza hotlink i CORS, a proxy obrazu tylko
  dodałoby przebieg. Świadomie użyto natywnego `<img>` z `loading="lazy"`.
- Paginacji z numerami: przy 82 tys. odcinków „pokaż więcej” jest czytelniejsze.
- Deduplikacja assetów po `id` — popyt jest rzadki, a `revalidate` w Next ogarnia cache.

---

## Testy

**Jednostkowe (`pnpm test`, vitest, 32 testy)** — najważniejsza część, bo logika
normalizacji jest jedynym miejscem, gdzie cicha zmiana danych z API psuje UI:

- `tests/media-url.test.ts` — nadpisanie adresów VPN w wariantach (marker w ścieżce,
  host `dev-*`, zdublowany host CDN, query/hash, pusta ścieżka, dane niepoprawne), detekcja HLS.
- `tests/normalize.test.ts` — budowa linku na produkcję, formatowanie czasu i dat,
  mapowanie read-modelu, niespójności `hasAudio`/`hasVideo` wobec identyfikatorów,
  pusta lista, brak publicznego `uri`, fallback czasu trwania z odcinka.

**E2E w przeglądarce (`pnpm verify:player`, 27 sprawdzeń)** — uruchamiane na
prawdziwym Chromium (Playwright) wobec działającej instancji i **prawdziwego API**:
render listy, link na produkcję, oznaczenia formatów, start odtwarzania, seek,
głośność, mute, pauza/wznowienie od miejsca pauzy, napisy (od blob do tekstu na
ekranie), przełączenie wideo → audio z przeniesieniem pozycji, brak wycieku pozycji
do kolejnego odcinka, „pokaż więcej”, responsywność (mobile/desktop, brak poziomego
scrolla) oraz brak błędów w konsoli.

Skrypt sam wyszukuje odcinek, który da się odtworzyć w przeglądarce, i osobno
sprawdza, że plik z nieobsługiwanym kodekiem pokazuje czytelny błąd — dzięki temu
przechodzi niezależnie od tego, który odcinek akurat trafi na pierwszą stronę.

---

## Czas poświęcony na zadanie

**około 8 godzin** (szacowanie zadania: 6–8 h), rozbicie:

| Etap | Czas |
| --- | --- |
| Rekonesans API, rozpoznanie formatów mediów | ~1 h |
| Szkielet Next.js, konfiguracja, Docker | ~0,5 h |
| Warstwa API: klient CMS, route handlery, normalizacja | ~1 h |
| Silnik odtwarzacza + panel + kontrolki | ~2 h |
| Lista odcinków, paginacja, responsywność, a11y | ~1 h |
| Testy jednostkowe i weryfikacja w przeglądarce | ~1,5 h |
| README, commity, sprzątanie | ~1 h |

Uwaga: około 2 h zdiagnozowano i naprawiono cztery realne problemy, których nie da
się zobaczyć bez uruchomienia odtwarzania w przeglądarce — brak dekodowania AC-3
w WAV-ach z API, odrzucane napisy WebVTT (`nosniff`), niebubble'ujące zdarzenie
`cuechange` oraz wyciek pozycji odtwarzania do kolejnego odcinka. Samo `tsc` i testy
jednostkowe były w tych przypadkach zielone.

Każdy z tych regresji ma pokrycie w `pnpm verify:player` — dla ostatniego celowo
sprawdziłem, że test **przestaje przechodzić** po ponownym wprowadzeniu błędu.
