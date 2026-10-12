import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const UI_ENTRY = path.join(HERE, 'ui', 'src', 'main.js');

/** Bundle the UI (ESM, in memory). Throws an Error that includes the esbuild messages on failure. */
export async function buildUi({ dev = false } = {}) {
  let result;
  try {
    result = await build({
      entryPoints: [UI_ENTRY],
      bundle: true,
      format: 'esm',
      target: 'es2022',
      write: false,
      sourcemap: dev ? 'inline' : false,
      logLevel: 'silent',
    });
  } catch (err) {
    const msgs = (err.errors ?? []).map((e) => `${e.location ? `${e.location.file}:${e.location.line}: ` : ''}${e.text}`);
    throw new Error(`UI bundle failed: ${msgs.length ? msgs.join('; ') : err.message}`);
  }
  return result.outputFiles[0].text;
}
