import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { REPO_ROOT } from './posts.mjs';
import { createManagerServer } from './server.mjs';

if (process.env.CI || process.env.NODE_ENV === 'production') {
  console.error('[blog] The blog manager is a local tool and refuses to run under CI or NODE_ENV=production.');
  process.exit(1);
}

const HOST = '127.0.0.1';
const port = Number(process.env.BLOG_PORT || 4322);
const astroPort = Number(process.env.BLOG_ASTRO_PORT || 4321);
for (const [name, p] of [['BLOG_PORT', port], ['BLOG_ASTRO_PORT', astroPort]]) {
  if (!Number.isInteger(p) || p < 1024 || p > 65535) {
    console.error(`[blog] ${name} must be an integer between 1024 and 65535.`);
    process.exit(1);
  }
}

const require = createRequire(import.meta.url);
const astroPkg = require.resolve('astro/package.json', { paths: [REPO_ROOT] });
const astroBin = path.join(path.dirname(astroPkg), 'bin', 'astro.mjs');

let astro = null;
let server = null;
let stopping = false;

function killAstro() {
  if (!astro || astro.exitCode !== null || astro.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(astro.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    astro.kill('SIGTERM');
  }
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  killAstro();
  if (server) server.close();
  process.exit(code);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(sig, () => shutdown(0));
process.on('exit', killAstro);
process.on('uncaughtException', (err) => {
  console.error('[blog] fatal:', err.message);
  shutdown(1);
});

server = createManagerServer({ port, astroPort });
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `[blog] Port ${port} is busy. Set BLOG_PORT to another port.` : `[blog] ${err.message}`);
  shutdown(1);
});

server.listen(port, HOST, () => {
  astro = spawn(process.execPath, [astroBin, 'dev', '--host', HOST, '--port', String(astroPort), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  astro.on('exit', (code) => {
    if (!stopping) {
      console.error(`[blog] astro dev exited (${code}). Is port ${astroPort} busy? Set BLOG_ASTRO_PORT to another port.`);
      shutdown(code || 1);
    }
  });
  console.log(`\n[blog] Manager:  http://${HOST}:${port}`);
  console.log(`[blog] Preview:  http://${HOST}:${astroPort}/blog`);
  console.log('[blog] Ctrl+C stops both.\n');
});
