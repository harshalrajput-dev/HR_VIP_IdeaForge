/**
 * Node cannot execute `.jsx` directly, so this runner bundles the render smoke
 * test with esbuild (already a Vite dependency) and executes the output.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../node_modules/.tmp');
const outFile = resolve(outDir, 'ssr-smoke.mjs');

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [resolve(here, 'ssr-smoke.jsx')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  jsx: 'automatic',
  // Keep every bare specifier external so it resolves from node_modules at runtime.
  packages: 'external',
  logLevel: 'error',
});

// react-router's dev build logs a useLayoutEffect SSR notice for every Link.
// This app is client-only, so that warning is expected noise - drop it.
const realError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
  realError(...args);
};

await import(pathToFileURL(outFile).href);
