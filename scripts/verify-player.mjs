/**
 * Skrypt weryfikacyjny (poza zakresem dostawy) — sprawdza w prawdziwej
 * przeglądarce: render listy, odtwarzanie, seek, głośność/mute, napisy,
 * przełączenie audio ↔ wideo, obsługę błędów, paginację i responsywność.
 *
 *   node scripts/verify-player.mjs [http://localhost:3100]
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const EXECUTABLE =
  process.env.CHROMIUM_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const mediaSelector = 'audio:not([hidden]), video:not([hidden])';

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});

const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

const isReady = () => {
  const el = document.querySelector('audio:not([hidden]), video:not([hidden])');
  return Boolean(el && el.readyState >= 1 && el.duration > 0);
};

await page.goto(BASE, { waitUntil: 'networkidle' });

// ---- lista ---------------------------------------------------------------
const playButtons = page.locator('button[aria-label^="Odtwórz"]');
const cardCount = await page.locator('ul > li').filter({ has: playButtons.first() }).count();
const totalRendered = await playButtons.count();
check('lista renderuje >= 10 odcinków', totalRendered >= 10, `${totalRendered} pozycji`);

const productionHref = await page
  .locator('a[href*="polskieradio.pl/podcasty/"]')
  .first()
  .getAttribute('href');
check(
  'tytuł linkuje na produkcję',
  /^https:\/\/www\.polskieradio\.pl\/podcasty\/[^/]+\/[^/]+$/.test(productionHref ?? ''),
  productionHref ?? 'brak',
);

const bothBadges = await page.locator('text=/Audio \\+ wideo/').count();
check('odcinki z oboma formatami są oznaczone', bothBadges > 0, `${bothBadges} pozycji`);

const firstCardText = await page.locator('ul > li').first().innerText();
const durationLine = firstCardText.split('\n').find((l) => /\d{1,2}:\d{2}/.test(l));
check('czas trwania sformatowany w karcie', Boolean(durationLine), durationLine ?? 'brak');

// ---- odtwarzanie: szukamy odcinka z plikiem obsługiwanym przez przeglądarkę ----
let playedIndex = -1;
let sawUnsupportedError = false;

for (let i = 0; i < Math.min(totalRendered, 8); i += 1) {
  await playButtons.nth(i).click();

  const outcome = await Promise.race([
    page.waitForFunction(isReady, null, { timeout: 30000 }).then(() => 'ready'),
    page
      .waitForSelector('aside[aria-label="Odtwarzacz"] [role="alert"]', { timeout: 30000 })
      .then(() => 'error'),
  ]).catch(() => 'timeout');

  if (outcome === 'error') {
    sawUnsupportedError = true;
    continue;
  }
  if (outcome === 'ready') {
    playedIndex = i;
    break;
  }
}

check('znaleziono odcinek odtwarzający się w przeglądarce', playedIndex >= 0, `indeks ${playedIndex}`);
check(
  'nieobsługiwany kodek pokazuje czytelny błąd (nie pustą listę)',
  sawUnsupportedError,
  sawUnsupportedError ? 'wystąpił' : 'nie było takiego przypadku w próbce',
);

if (playedIndex < 0) {
  await browser.close();
  process.exit(1);
}

const mediaInfo = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return { tag: el.tagName, duration: el.duration, src: (el.currentSrc || el.src || '').slice(0, 100) };
}, mediaSelector);
check('źródło mediów ustawione i odczytany czas trwania', mediaInfo.duration > 0, `${Math.round(mediaInfo.duration)}s`);

await page.waitForTimeout(2500);
const playing = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return { paused: el.paused, t: el.currentTime };
}, mediaSelector);
check('odtwarzanie startuje', !playing.paused && playing.t > 0, `t=${playing.t.toFixed(2)}s`);

// ---- seek ----------------------------------------------------------------
const seeked = await page.evaluate(async (sel) => {
  const range = document.querySelector('input[type=range][aria-valuetext]');
  if (!range) return null;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  setter.call(range, '120');
  for (const type of ['input', 'change', 'pointerup']) {
    range.dispatchEvent(new Event(type, { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 2500));
  return document.querySelector(sel).currentTime;
}, mediaSelector);
check('seek przewija odtwarzacz', seeked !== null && seeked > 100, `t=${seeked?.toFixed(1)}s`);

// ---- głośność / mute -----------------------------------------------------
const volumeState = await page.evaluate(async () => {
  const vol = [...document.querySelectorAll('input[type=range]')].find((r) =>
    r.getAttribute('aria-valuetext')?.includes('Głośność'),
  );
  if (!vol) return null;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(vol, '0.4');
  vol.dispatchEvent(new Event('input', { bubbles: true }));
  vol.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  return { element: document.querySelector('audio, video').volume };
});
check(
  'głośność zmienia element audio/video',
  volumeState && Math.abs(volumeState.element - 0.4) < 0.05,
  `volume=${volumeState?.element}`,
);

if ((await page.locator('button[aria-label="Wycisz"]').count()) > 0) {
  await page.locator('button[aria-label="Wycisz"]').first().click();
  await page.waitForTimeout(300);
  const muted = await page.evaluate(() => document.querySelector('audio, video').muted);
  check('mute wycisza element', muted === true);
  await page.locator('button[aria-label="Wyłącz dźwięk"]').first().click();
  await page.waitForTimeout(200);
}

// ---- pauza / wznowienie --------------------------------------------------
await page.locator('button[aria-label="Pauza"]').first().click();
await page.waitForTimeout(400);
const paused = await page.evaluate((sel) => document.querySelector(sel).paused, mediaSelector);
check('pauza zatrzymuje odtwarzanie', paused === true);

await page.locator('button[aria-label="Odtwórz"]').first().click();
await page.waitForTimeout(1200);
const resumed = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return { paused: el.paused, t: el.currentTime };
}, mediaSelector);
check('wznowienie kontynuuje od miejsca pauzy', !resumed.paused && resumed.t > 110, `t=${resumed.t.toFixed(1)}s`);

// ---- napisy --------------------------------------------------------------
const vtt = await page.evaluate(() => {
  const el = document.querySelector('audio:not([hidden]), video:not([hidden])');
  const track = el.querySelector('track');
  return { has: Boolean(track), src: track?.getAttribute('src') ?? null };
});
// Napisy podpinamy jako blob:text/vtt, bo CDN serwuje WebVTT jako
// application/octet-stream + nosniff i przeglądarka go odrzuca.
check(
  'napisy WebVTT podpięte jako blob (poprawny MIME)',
  vtt.has && vtt.src.startsWith('blob:'),
  vtt.src ?? 'brak',
);

const vttPayload = await page.evaluate(async () => {
  const el = document.querySelector('audio:not([hidden]), video:not([hidden])');
  const src = el.querySelector('track')?.getAttribute('src');
  if (!src) return null;
  const text = await (await fetch(src)).text();
  return { head: text.slice(0, 6), cues: (text.match(/-->/g) ?? []).length };
});
check(
  'napisy to poprawny WebVTT z cue’ami',
  vttPayload?.head === 'WEBVTT' && vttPayload.cues > 10,
  `${vttPayload?.head}, ${vttPayload?.cues} cue'ów`,
);

await page.locator('button[aria-label="Przełącz napisy"]').first().click();
await page.waitForTimeout(2500);
const cue = await page.evaluate(() => {
  const el = document.querySelector('audio:not([hidden]), video:not([hidden])');
  const track = el.textTracks[0];
  if (!track) return null;
  const active = track.activeCues;
  return {
    mode: track.mode,
    text: active && active.length > 0 ? active[0].text.trim().slice(0, 50) : null,
  };
});
check(
  'napisy włączone i renderują tekst',
  cue?.mode === 'showing' && Boolean(cue.text),
  JSON.stringify(cue),
);

await page.waitForTimeout(600);
const cueInUi = await page.locator('aside[aria-label="Odtwarzacz"]').innerText();
check(
  'tekst napisu widoczny w panelu',
  Boolean(cue?.text) && cueInUi.includes(cue.text),
  `szukano: ${JSON.stringify(cue?.text)}`,
);

// ---- przełączenie formatu ----------------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' });
// `li` w filtrze musi zawierać przycisk play — samo hasText trafiałoby
// w wewnętrzne `li` z odznakami formatu.
const bothFormats = page
  .locator('li')
  .filter({ has: page.locator('button[aria-label^="Odtwórz"]'), hasText: 'Audio + wideo' });
const videoCard = bothFormats.first();
check('znaleziono odcinek z oboma formatami', (await videoCard.count()) > 0, `${await bothFormats.count()} szt.`);

if ((await videoCard.count()) > 0) {
  await videoCard.locator('button[aria-label^="Odtwórz"]').first().click();
  await page.waitForFunction(isReady, null, { timeout: 60000 });
  await page.waitForTimeout(2000);

  // Cofamy daleko PRZED przełączeniem formatu — dzięki temu jednocześnie
  // sprawdzamy przeniesienie pozycji i wyciek pozycji do następnego odcinka.
  const jumped = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    const range = document.querySelector('input[type=range][aria-valuetext]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const target = Math.min(300, el.duration - 20);
    range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    setter.call(range, String(target));
    for (const type of ['input', 'change', 'pointerup']) {
      range.dispatchEvent(new Event(type, { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 4000));
    return { target, actual: el.currentTime };
  }, mediaSelector);
  check('seek daleko przed przełączeniem', jumped.actual > jumped.target - 20, `t=${jumped.actual.toFixed(0)}s`);

  const before = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { tag: el.tagName, t: el.currentTime };
  }, mediaSelector);

  await page
    .locator('button[role="radio"][aria-checked]')
    .filter({ hasText: /^Audio$/ })
    .first()
    .click();

  const switched = await page
    .waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.tagName === 'AUDIO' && el.readyState >= 1 && el.duration > 0;
      },
      mediaSelector,
      { timeout: 60000 },
    )
    .then(() => true)
    .catch(() => false);

  await page.waitForTimeout(3000);
  const after = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { tag: el.tagName, t: el.currentTime, paused: el.paused };
  }, mediaSelector);

  check('domyślnie startuje wideo', before.tag === 'VIDEO', before.tag);
  check('przełączenie wideo → audio działa', switched && after.tag === 'AUDIO', `po: ${after.tag}`);
  check(
    'pozycja odtwarzania przenosi się między formatami',
    after.t > jumped.target - 30 && Math.abs(after.t - before.t) < 20,
    `${before.t.toFixed(0)}s → ${after.t.toFixed(0)}s`,
  );

  // Regresja: pozycja z poprzedniego odcinka nie może wyciec do następnego.
  const freshCard = bothFormats.nth(1);
  if ((await freshCard.count()) > 0) {
    await freshCard.locator('button[aria-label^="Odtwórz"]').first().click();
    await page
      .waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          return el && el.readyState >= 1 && el.currentTime > 0.2;
        },
        mediaSelector,
        { timeout: 60000 },
      )
      .catch(() => undefined);
    await page.waitForTimeout(1500);
    const freshTime = await page.evaluate((sel) => document.querySelector(sel).currentTime, mediaSelector);
    check(
      'nowy odcinek startuje od zera (nie od pozycji poprzedniego)',
      freshTime < 15 && freshTime < after.t / 2,
      `poprzedni t=${after.t.toFixed(0)}s → nowy t=${freshTime.toFixed(2)}s`,
    );
  }
}

// ---- paginacja -----------------------------------------------------------
const loadMore = page.locator('button', { hasText: 'Pokaż więcej odcinków' });
if ((await loadMore.count()) > 0) {
  const before = await page.locator('button[aria-label^="Odtwórz"]').count();
  await loadMore.first().click();
  await page.waitForFunction(
    (n) => document.querySelectorAll('button[aria-label^="Odtwórz"]').length > n,
    before,
    { timeout: 30000 },
  );
  const after = await page.locator('button[aria-label^="Odtwórz"]').count();
  check('„pokaż więcej” dociąga kolejną stronę', after > before, `${before} → ${after}`);
} else {
  check('„pokaż więcej” dostępne', false, 'nie znaleziono przycisku');
}

// ---- responsywność -------------------------------------------------------
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
const mobile = await page.evaluate(() => {
  const panel = document.querySelector('aside[aria-label="Odtwarzacz"]');
  return {
    position: getComputedStyle(panel).position,
    overflowsX: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
});
check(
  'mobile: panel przyklejony, bez poziomego scrolla',
  mobile.position === 'fixed' && !mobile.overflowsX,
  JSON.stringify(mobile),
);
await page.screenshot({ path: 'verify-mobile.png' });

await page.setViewportSize({ width: 1400, height: 950 });
await page.waitForTimeout(500);
const desktop = await page.evaluate(() => {
  const panel = document.querySelector('aside[aria-label="Odtwzarcz"], aside[aria-label="Odtwarzacz"]');
  return { position: getComputedStyle(panel).position, overflowsX: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
check('desktop: panel w kolumnie bocznej, bez poziomego scrolla', desktop.position === 'sticky' && !desktop.overflowsX, JSON.stringify(desktop));
await page.screenshot({ path: 'verify-desktop.png' });

check('brak błędów w konsoli', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} sprawdzeń przeszło.`);
process.exit(failed.length === 0 ? 0 : 1);
