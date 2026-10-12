// Browser UI test for the blog manager (local only, not in CI). Usage: npm run blog:ui-test
// Drives the installed Microsoft Edge (or Chrome) through playwright-core, so no browser is downloaded.
// Starts the manager on a free loopback port against a temp copy of the content tree; git/gh are stubbed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createManagerServer } from './server.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function launch() {
  const errors = [];
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch (err) {
      errors.push(`${channel}: ${String(err.message).split('\n')[0]}`);
    }
  }
  console.error(`No Edge or Chrome found for the UI test.\n  ${errors.join('\n  ')}`);
  process.exit(1);
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-ui-test-'));
const shots = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-ui-shots-'));
const posts = path.join(root, 'src', 'content', 'blog');
await fs.mkdir(posts, { recursive: true });
await fs.writeFile(path.join(posts, 'published-one.md'), '---\ntitle: Published one\ndescription: An old story about things.\npubDate: 2026-09-01\ntags:\n  - data\ndraft: false\n---\n\nHello **world**.\n');
const read = (name) => fs.readFile(path.join(posts, name), 'utf8');

const fakeRun = async (cmd, a) => {
  if (cmd === 'git' && a[0] === 'worktree' && a[1] === 'add') await fs.mkdir(a.at(-2), { recursive: true });
  if (cmd === 'git' && a[0] === 'status' && a.includes('--porcelain')) return ' M changed';
  if (cmd === 'gh' && a[0] === 'pr' && a[1] === 'view') throw new Error('no pr');
  if (cmd === 'gh' && a[0] === 'pr' && a[1] === 'create') return 'https://example.invalid/pr/1';
  return '';
};

// bind once to learn a free port, then start the real server there (Host/Origin checks need the final port)
const probe = createManagerServer({ port: 0, astroPort: 1, root, run: fakeRun });
await new Promise((r) => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
// astroPort 1 is closed, so the "preview is down" banner is expected
const server = createManagerServer({ port, astroPort: 1, root, run: fakeRun });
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const base = `http://127.0.0.1:${port}`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const problems = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) problems.push(`console ${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => console.error('CSP violation', e.violatedDirective, e.blockedURI));
});

let passed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    process.exitCode = 1;
    console.error(`FAIL ${name}\n     ${err.stack || err}`);
    await page.screenshot({ path: path.join(shots, `fail-${passed}.png`) }).catch(() => {});
    throw err;
  }
}
const pasteImage = (name, buf) =>
  page.evaluate(
    async ({ name, b64 }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], name, { type: 'image/png' }));
      document.querySelector('.cm-content').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { name, b64: buf.toString('base64') },
  );
const goBack = () => page.click('.topbar a:has-text("Stories")');
const isPostPut = (route) => route.request().method() === 'PUT';
// failed requests on purpose: Chromium logs them as console errors, which are not product problems
const forgetNetworkNoise = () => {
  for (let i = problems.length - 1; i >= 0; i--) if (/Failed to load resource/.test(problems[i])) problems.splice(i, 1);
};
const settled = () => page.waitForTimeout(1600); // autosave is 1000ms

try {
  await step('stories list shows Drafts and Published tabs with counts', async () => {
    await page.goto(`${base}/`);
    await page.waitForSelector('.cards, .empty');
    await page.getByRole('tab', { name: 'Drafts (0)' }).waitFor();
    await page.getByRole('tab', { name: 'Published (1)' }).click();
    assert.equal(await page.locator('.card').count(), 1);
    await page.screenshot({ path: path.join(shots, '01-stories.png') });
    await page.getByRole('tab', { name: 'Drafts (0)' }).click();
  });

  await step('create a post, title and body autosave to the Markdown file', async () => {
    await page.click('#new-btn');
    await page.fill('#n-title', 'My First Story');
    await page.fill('#n-slug', 'my-story');
    await page.click('#new-form button[type=submit]');
    await page.waitForSelector('.cm-content');
    await page.fill('.subtitle', 'A short description of it.');
    await page.click('.cm-content');
    await page.keyboard.type('Hello brave new world.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph.');
    await page.waitForSelector('text=/Saved/', { timeout: 5000 });
    await settled();
    const file = await read('my-story.md');
    assert.match(file, /description: A short description of it\./);
    assert.match(file, /Hello brave new world\.\n\nSecond paragraph\./);
  });

  await step('selection toolbar: Bold wraps the selection in ** in the saved file', async () => {
    await page.click('.cm-content');
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Control+Shift+ArrowRight');
    await page.waitForSelector('.cm-sel-toolbar');
    await page.screenshot({ path: path.join(shots, '02-toolbar.png') });
    await page.click('.cm-sel-bold');
    await settled();
    assert.match(await read('my-story.md'), /\*\*Hello\*\* brave new world\./);
  });

  await step('"+" inserter adds a divider', async () => {
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.cm-plus');
    await page.click('.cm-plus');
    await page.click('.cm-plus-item[aria-label="Divider"]');
    await settled();
    assert.match(await read('my-story.md'), /\n---\n/);
  });

  await step('pasting a PNG uploads it to assets and inserts the Markdown image', async () => {
    await page.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], 'shot.png', { type: 'image/png' }));
      document.querySelector('.cm-content').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, PNG.toString('base64'));
    await page.waitForSelector('.cm-image img', { timeout: 5000 });
    await settled();
    assert.match(await read('my-story.md'), /!\[\]\(\.\.\/\.\.\/assets\/blog\/my-story\/shot\.png\)/);
    await fs.access(path.join(root, 'src', 'assets', 'blog', 'my-story', 'shot.png'));
    await page.screenshot({ path: path.join(shots, '03-image.png') });
  });

  await step('Markdown source toggle shows raw text', async () => {
    await page.click('button:has-text("Markdown")');
    await page.waitForSelector('.cm-source');
    assert.match(await page.locator('.cm-content').innerText(), /\*\*Hello\*\*/);
    await page.click('button:has-text("Markdown")');
    await page.waitForSelector('.cm-editor:not(.cm-source)');
  });

  await step('cover upload, then publish dialog requires cover alt text', async () => {
    await page.setInputFiles('.canvas input[type=file]', { name: 'my cover.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('.cover img');
    await settled();
    assert.match(await read('my-story.md'), /cover: \.\.\/\.\.\/assets\/blog\/my-story\/cover\.png/);
    await page.click('button:has-text("Publish")');
    await page.click('#publish-dialog button[type=submit]');
    assert.match(await page.textContent('#publish-dialog .error'), /alt text/i);
    await page.screenshot({ path: path.join(shots, '04-publish-dialog.png') });
  });

  await step('publish with cover alt (git/gh stubbed) shows the PR link', async () => {
    await page.locator('#publish-dialog').getByPlaceholder('Describe the cover image').fill('A single pixel');
    await page.click('#publish-dialog button[type=submit]');
    await page.waitForSelector('#publish-dialog a[href="https://example.invalid/pr/1"]', { timeout: 10000 });
    await page.click('#publish-dialog button[type=submit]'); // "Done"
    assert.match(await read('my-story.md'), /coverAlt: A single pixel/);
  });

  await step('Published tab lists both stories after publishing', async () => {
    await page.goto(`${base}/#/`);
    await page.waitForSelector('.stabs');
    await page.getByRole('tab', { name: 'Published (2)' }).click();
    assert.equal(await page.locator('.card').count(), 2);
    await page.getByRole('tab', { name: 'Drafts (0)' }).waitFor();
  });

  await step('delete from the card menu removes the post and its images', async () => {
    await page.click('button[aria-label="Actions for My First Story"]');
    await page.click('[role=menuitem]:has-text("Delete")');
    await page.fill('#d-input', await page.textContent('#d-slug'));
    await page.click('#d-ok');
    await page.waitForFunction(() => !document.body.textContent.includes('My First Story'));
    assert.deepEqual(await fs.readdir(posts), ['published-one.md']);
    await assert.rejects(fs.access(path.join(root, 'src', 'assets', 'blog', 'my-story')));
  });

  await step('published post: Ctrl+S, Publish dialog and leaving never write an unedited post', async () => {
    const file = path.join(posts, 'published-one.md');
    const before = { text: await read('published-one.md'), mtime: (await fs.stat(file)).mtimeMs };
    await page.goto(`${base}/#/edit/published-one`);
    await page.waitForSelector('.cm-content');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+s');
    await page.click('button:has-text("Publish update")');
    await page.click('#publish-dialog button:has-text("Cancel")');
    await goBack();
    await page.waitForSelector('.stabs');
    await settled();
    assert.equal(await read('published-one.md'), before.text);
    assert.equal((await fs.stat(file)).mtimeMs, before.mtime, 'file was rewritten');
  });

  await step('new draft for the editor flow checks', async () => {
    await page.click('#new-btn');
    await page.fill('#n-title', 'Media Story');
    await page.fill('#n-slug', 'media-story');
    await page.click('#new-form button[type=submit]');
    await page.waitForSelector('.cm-content');
    await page.click('.cm-content');
    await page.keyboard.type('Intro line.');
    await settled();
  });

  const assets = path.join(root, 'src', 'assets', 'blog', 'media-story');
  await step('pasting two images with the same name keeps both files', async () => {
    const second = Buffer.concat([PNG, Buffer.from('second')]);
    await pasteImage('image.png', PNG);
    await page.waitForSelector('.cm-image img');
    await pasteImage('image.png', second);
    await page.waitForFunction(() => document.querySelectorAll('.cm-image img').length === 2);
    await settled();
    const md = await read('media-story.md');
    assert.match(md, /media-story\/image\.png\)/);
    assert.match(md, /media-story\/image-2\.png\)/);
    assert.ok(PNG.equals(await fs.readFile(path.join(assets, 'image.png'))));
    assert.ok(second.equals(await fs.readFile(path.join(assets, 'image-2.png'))));
  });

  await step('leaving with an upload in flight waits for it and never saves the placeholder', async () => {
    await page.route('**/api/posts/media-story/images*', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.click('.cm-content');
    await page.keyboard.press('Control+End');
    await pasteImage('slow.png', PNG);
    await page.waitForTimeout(1400); // the 1s autosave fires while the upload is still running
    assert.doesNotMatch(await read('media-story.md'), /Uploading/);
    await goBack();
    await page.waitForSelector('.stabs', { timeout: 8000 });
    await page.unroute('**/api/posts/media-story/images*');
    const md = await read('media-story.md');
    assert.doesNotMatch(md, /Uploading/);
    assert.match(md, /media-story\/slow\.png\)/);
  });

  await step('leaving while a save is in flight: one save at a time, latest text wins', async () => {
    await page.goto(`${base}/#/edit/media-story`);
    await page.waitForSelector('.cm-content');
    let inFlight = 0;
    let overlap = false;
    await page.route('**/api/posts/media-story', async (route) => {
      if (!isPostPut(route)) return route.continue();
      overlap ||= ++inFlight > 1;
      await new Promise((r) => setTimeout(r, 900));
      await route.continue();
      inFlight--;
    });
    await page.click('.cm-content');
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('End');
    await page.keyboard.type(' AAA');
    await page.waitForTimeout(1300); // autosave PUT is now in flight
    await page.keyboard.type('BBB');
    await goBack();
    await page.waitForSelector('.stabs', { timeout: 8000 });
    await page.unroute('**/api/posts/media-story');
    assert.equal(overlap, false, 'two PUTs overlapped');
    assert.match(await read('media-story.md'), / AAABBB/);
  });

  await step('failed save on leaving keeps the user on the page, Retry then saves', async () => {
    await page.goto(`${base}/#/edit/media-story`);
    await page.waitForSelector('.cm-content');
    await page.route('**/api/posts/media-story', (route) => (isPostPut(route) ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"disk on fire"}' }) : route.continue()));
    await page.click('.cm-content');
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('End');
    await page.keyboard.type(' CCC');
    await goBack();
    await page.waitForSelector('.save-state.err');
    assert.match(await page.textContent('.save-state'), /disk on fire/);
    assert.match(page.url(), /#\/edit\/media-story$/);
    await page.waitForSelector('.cm-content');
    await page.unroute('**/api/posts/media-story');
    await page.click('.save-state button:has-text("Retry")');
    await page.waitForSelector('text=/Saved/');
    assert.match(await read('media-story.md'), / AAABBB CCC/);
    await goBack();
    await page.waitForSelector('.stabs');
    forgetNetworkNoise();
  });

  await step('selection toolbar Link flow wraps the selection in a Markdown link', async () => {
    await page.goto(`${base}/#/edit/media-story`);
    await page.waitForSelector('.cm-content');
    await page.locator('.cm-line').first().click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Control+Shift+ArrowRight');
    await page.waitForSelector('.cm-sel-toolbar');
    await page.click('.cm-sel-link');
    await page.fill('.cm-sel-linkform input', 'example.com');
    await page.keyboard.press('Enter');
    await settled();
    assert.match(await read('media-story.md'), /\[Intro\]\(https:\/\/example\.com\/?\)/);
  });

  await step('no console errors, warnings, page errors or CSP violations', () => {
    assert.deepEqual(problems, []);
  });
  console.log(`\npassed: ${passed} steps ok (screenshots in ${shots})`);
} catch {
  console.error(`\nFAILED after ${passed} steps. Problems seen: ${JSON.stringify(problems)}\nScreenshots: ${shots}`);
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
if (!process.exitCode) await fs.rm(root, { recursive: true, force: true });
