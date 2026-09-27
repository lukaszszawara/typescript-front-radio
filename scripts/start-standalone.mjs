/**
 * Uruchamia build `output: 'standalone'` w sposób zgodny z obrazem Docker:
 * kopiuje statyczne zasoby do katalogu standalone i startuje `server.js`.
 *
 *   pnpm start
 */
import { cp, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(root, '.next', 'standalone');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.error('Brak katalogu .next/standalone — najpierw wykonaj `pnpm build`.');
  process.exit(1);
}

await cp(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
if (await exists(join(root, 'public'))) {
  await cp(join(root, 'public'), join(standalone, 'public'), { recursive: true });
}

const child = spawn(process.execPath, [join(standalone, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: process.env.HOSTNAME ?? '0.0.0.0' },
});

child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
