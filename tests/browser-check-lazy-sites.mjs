// Focused browser QA for per-site dataset loading. This is intentionally not
// part of `npm test`; run only after the dataset API is stable and the browser
// slot is released:
//   $env:QA_URL='http://localhost:4173'; node tests/browser-check-lazy-sites.mjs
//   $env:QA_OUT='../tmp/lunar-lazy-sites'; node tests/browser-check-lazy-sites.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.QA_URL || 'http://localhost:4173').replace(/\/$/, '');
const OUT = process.env.QA_OUT ? resolve(process.env.QA_OUT) : resolve(ROOT, '..', 'tmp', 'lunar-lazy-sites');
const ONLY = process.env.QA_ONLY || '';
const manifest = JSON.parse(readFileSync(join(ROOT, 'public/data/manifest.json'), 'utf8'));
const siteById = new Map(manifest.sites.map((site) => [site.id, site]));
const checks = [];
const errors = [];
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
console.log('browser', browser.version(), 'base', BASE, 'WebGL=SwiftShader');

async function check(name, fn) {
  if (ONLY && !name.includes(ONLY)) {
    console.log('SKIP', name);
    return;
  }
  const start = Date.now();
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail: detail || '', ms: Date.now() - start });
    console.log('PASS', name);
  } catch (error) {
    checks.push({ name, ok: false, detail: String(error.message || error).split('\n')[0], ms: Date.now() - start });
    console.log('FAIL', name, String(error.message || error).split('\n')[0]);
  }
}

function instrument(page, tag, options = {}) {
  const requests = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !options.ignoreConsoleErrors?.(message.text())) errors.push({ tag, kind: 'console', detail: message.text() });
  });
  page.on('pageerror', (error) => errors.push({ tag, kind: 'page', detail: String(error) }));
  page.on('requestfailed', (request) => errors.push({ tag, kind: 'request', detail: `${request.url()} ${request.failure()?.errorText || ''}` }));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/data/')) return;
    const path = url.pathname.slice('/data/'.length);
    const record = { path, version: url.searchParams.get('v'), status: response.status(), at: Date.now() };
    requests.push(record);
    if (path.startsWith('sites/')) options.onSiteResponse?.(record);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/data/sites/'))
      options.onSiteRequest?.({ path: url.pathname.slice('/data/'.length), at: Date.now() });
  });
  if (options.intercept) page.route('**/data/**', options.intercept);
  return requests;
}

async function open(page, route) {
  await page.goto(`${BASE}/?qa=lazy-sites#/${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('main h1').waitFor({ timeout: 20000 });
  const intro = page.getByRole('dialog', { name: 'Lunacline' });
  // Let the opening close on its own. Clicking Skip is a pointer gesture and
  // would intentionally trigger the new all-sites prefetch before we measure
  // which files were needed just to enter the route.
  if (await intro.count()) await intro.waitFor({ state: 'hidden', timeout: 6000 });
}

async function routeDataSettled(page) {
  await page.waitForFunction(() => {
    const status = document.querySelector('.data-status');
    return !status || /not available/i.test(status.innerText);
  }, null, { timeout: 30000 });
}

const sitesRequested = (requests) => requests
  .filter((r) => r.path.startsWith('sites/'))
  .map((r) => r.path);
const pathFor = (id) => siteById.get(id)?.file;
const unique = (values) => [...new Set(values)].sort();
const lastCoverageDate = manifest.period.endUtc.slice(0, 10);

await check('route loads only the site data required by that page', async () => {
  const cases = [
    { route: 'home', expected: ['shackleton-rim', 'connecting-ridge'] },
    { route: 'learn', expected: ['malapert-massif'] },
    { route: 'compare', controls: ['#site', '#alternative'] },
    { route: 'review', expected: [manifest.sites[0].id, manifest.sites[1].id] },
    { route: 'simulator', controls: ['#explorer-site'], needsEphemerides: true },
  ];
  const report = [];
  for (const testCase of cases) {
    console.log('route-check', testCase.route);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const requests = instrument(page, `route-${testCase.route}`);
    const enteredAt = Date.now();
    await open(page, testCase.route);
    console.log('route-opened', testCase.route);
    await routeDataSettled(page);
    if (testCase.route === 'home') {
      await page.locator('.delay-briefing .briefing-results article').first().waitFor({ timeout: 20000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.delay-briefing .hl-num')].length === 2 && [...document.querySelectorAll('.delay-briefing .hl-num')].every((e) => /\d/.test(e.innerText)));
    } else if (testCase.route === 'learn') {
      await page.getByText(/worked example/i).first().waitFor({ timeout: 20000 });
    } else if (testCase.route === 'simulator') {
      await page.waitForFunction(() => !!document.querySelector('canvas')?.lunarSnapshot?.()?.rendered?.ready, null, { timeout: 30000 });
    } else if (testCase.route === 'review') {
      await page.locator('.review-bars').first().waitFor({ timeout: 20000 });
    } else {
      await page.locator('#site').waitFor({ timeout: 20000 });
      await page.locator('#alternative').waitFor({ timeout: 20000 });
    }
    // Do not let the 15-second prefetch timer alter the route-specific request set.
    const expectedIds = testCase.expected || await Promise.all(testCase.controls.map((selector) => page.locator(selector).inputValue()));
    const expectedPaths = unique(expectedIds.map(pathFor).filter(Boolean));
    const manifestAt = requests.find((r) => r.path === 'manifest.json')?.at ?? enteredAt;
    const initialSiteRequests = requests.filter((r) => r.path.startsWith('sites/') && r.at < manifestAt + 15000);
    const actualPaths = unique(initialSiteRequests.map((r) => r.path));
    expect(JSON.stringify(actualPaths) === JSON.stringify(expectedPaths), `${testCase.route}: requested ${JSON.stringify(actualPaths)}, expected ${JSON.stringify(expectedPaths)}`);
    if (testCase.needsEphemerides) {
      const ephemerisPaths = unique(requests.filter((r) => ['sky.json', 'planets.json'].includes(r.path)).map((r) => r.path));
      expect(ephemerisPaths.includes('sky.json'), `Simulator should load sky.json on mount; got ${JSON.stringify(ephemerisPaths)}`);
      const planetsResponse = requests.find((r) => r.path === 'planets.json');
      expect(!planetsResponse || planetsResponse.at >= manifestAt + 15000, `planets.json loaded before interaction/idle timeout: ${JSON.stringify(planetsResponse)}`);
      const sceneEntryElapsedMs = Date.now() - manifestAt;
      if (sceneEntryElapsedMs < 15000) {
        await page.keyboard.press('ArrowRight');
        await page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/planets.json'), { timeout: 10000 });
      }
    }
    report.push({ route: testCase.route, expectedPaths, actualPaths, ephemerides: requests.filter((r) => ['sky.json', 'planets.json'].includes(r.path)).map((r) => r.path) });
    await context.close();
  }
  return JSON.stringify(report);
});

await check('rapid A→B→A site changes deduplicate fetches and never leave stale results', async () => {
  let delayedPath = '';
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const requests = instrument(page, 'rapid-site-switch', {
    intercept: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith(delayedPath) && delayedPath) await wait(900);
      await route.continue();
    },
  });
  await open(page, 'compare');
  await routeDataSettled(page);
  const selector = page.locator('#site');
  await selector.waitFor();
  const ids = await selector.locator('option').evaluateAll((options) => options.map((option) => option.value));
  const a = await selector.inputValue();
  const alternative = await page.locator('#alternative').inputValue();
  const b = ids.find((id) => id !== a && id !== alternative);
  expect(a && b, `need distinct selectable site IDs (A=${a}, B=${b})`);
  delayedPath = pathFor(b);
  let signalBStarted;
  const bStarted = new Promise((resolveStarted) => { signalBStarted = resolveStarted; });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith(delayedPath)) signalBStarted();
  });
  // Observe that the B fetch really began before selecting A again; otherwise
  // this would test only two synchronous control changes, not an in-flight race.
  await selector.selectOption(b);
  await bStarted;
  await selector.selectOption(a);
  await page.waitForTimeout(1200);
  await routeDataSettled(page);
  expect(await selector.inputValue() === a, `selected site ended at ${await selector.inputValue()}, expected A=${a}`);
  const sitePaths = sitesRequested(requests);
  expect(sitePaths.filter((path) => path === pathFor(a)).length === 1, `A was not deduplicated: ${JSON.stringify(sitePaths)}`);
  const displayedPlace = await page.locator('.answer-scenario .answer-context dd').first().innerText();
  const aName = siteById.get(a).name.split(' (')[0];
  expect(displayedPlace === aName, `visible comparison says ${displayedPlace}, expected A=${aName}`);
  await context.close();
  return `A=${a}, B=${b}; site requests=${JSON.stringify(sitePaths)}`;
});

await check('missing site data blocks exports, while out-of-coverage is explicitly not calculated', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  let release;
  let started;
  const siteStarted = new Promise((resolveStarted) => { started = resolveStarted; });
  const gate = new Promise((resolveGate) => { release = resolveGate; });
  instrument(page, 'export-while-site-pending', {
    intercept: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/sites/')) {
        started(url.pathname);
        await gate;
      }
      await route.continue();
    },
  });
  await open(page, 'compare');
  await siteStarted;
  const exportButton = page.locator('.comparison-export').getByRole('button', { name: 'Download comparison · JSON', exact: true });
  if (await exportButton.count()) expect(await exportButton.isDisabled(), 'JSON export enabled while required site data is still pending');
  release();
  await routeDataSettled(page);
  await page.locator('#arrival').fill(lastCoverageDate);
  await page.locator('#arrival').dispatchEvent('change');
  await page.waitForTimeout(250);
  const notCalculated = await page.getByText('Not calculated', { exact: true }).count();
  expect(notCalculated > 0, 'out-of-coverage comparison did not show Not calculated');
  expect(await exportButton.isEnabled(), 'valid settings outside coverage should remain exportable as an explicitly not-calculated report');
  await context.close();
  return 'required data pending blocks JSON export; out-of-coverage report stays exportable with Not calculated values';
});

async function assertBadSiteResponse(kind) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const targetFile = manifest.sites[0].file;
  let selectedSite = '';
  const requests = instrument(page, `bad-site-${kind}`, {
    ignoreConsoleErrors: kind === 'http' ? (text) => /503 \(Service Unavailable\)/.test(text) : undefined,
    intercept: async (route) => {
      const url = new URL(route.request().url());
      if (targetFile && url.pathname.endsWith(targetFile)) {
        const response = await route.fetch();
        if (kind === 'http') {
          await route.fulfill({ status: 503, contentType: 'text/plain', body: 'temporary dataset failure' });
          return;
        }
        const json = await response.json();
        selectedSite = json.siteId;
        if (kind === 'wrong-id') json.siteId = 'not-the-requested-site';
        if (kind === 'short-shape') json.horizon.elevationDeg[String(manifest.observerHeightsM[0])] = json.horizon.elevationDeg[String(manifest.observerHeightsM[0])].slice(0, 719);
        await route.fulfill({ response, json });
        return;
      }
      await route.continue();
    },
  });
  await open(page, 'compare');
  await page.getByText(/Scientific dataset is not available/i).waitFor({ timeout: 30000 });
  const visible = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(!/NaN|undefined/.test(visible), `${kind}: malformed data leaked numeric garbage into the page`);
  const exports = page.locator('.comparison-export button');
  const activeExports = await exports.evaluateAll((buttons) => buttons.filter((button) => !button.disabled).length);
  expect(activeExports === 0, `${kind}: ${activeExports} export button(s) remained enabled without valid required site data`);
  const checkResult = { kind, targetFile, selectedSite, siteRequests: sitesRequested(requests), status: visible.includes('not available') };
  await context.close();
  return JSON.stringify(checkResult);
}

await check('HTTP failure, wrong site identity and invalid shape fail closed without numeric results', async () => {
  for (const kind of ['http', 'wrong-id', 'short-shape']) await assertBadSiteResponse(kind);
  return '503, wrong siteId and 719-point horizon each show the unavailable state and disable exports';
});

await check('required-site failures on Home, Learn and Review show an error instead of endless loading', async () => {
  const cases = [
    { route: 'home', siteId: 'connecting-ridge', content: /Land a week late/i },
    { route: 'learn', siteId: 'malapert-massif', content: /How Lunacline works/i },
    { route: 'review', siteId: manifest.sites[0].id, content: /If a Moon landing is delayed/i },
  ];
  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const targetFile = pathFor(item.siteId);
    const requests = instrument(page, `required-failure-${item.route}`, {
      ignoreConsoleErrors: (text) => /503 \(Service Unavailable\)/.test(text),
      intercept: async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith(targetFile)) {
          await route.fulfill({ status: 503, contentType: 'text/plain', body: 'required site unavailable' });
          return;
        }
        await route.continue();
      },
    });
    await open(page, item.route);
    await page.getByText(/Scientific dataset is not available/i).waitFor({ timeout: 30000 });
    const main = page.locator('main');
    const text = (await main.innerText()).replace(/\s+/g, ' ');
    expect(item.content.test(text), `${item.route}: static page content disappeared after site failure`);
    expect(!/Loading the documented scientific dataset/i.test(text), `${item.route}: route remained in loading state after HTTP 503`);
    if (item.route === 'home') {
      const values = await page.locator('.delay-briefing .hl-num').allInnerTexts();
      expect(values.length === 2 && values.every((value) => value.trim() === '–'), `Home should preserve placeholder cards, got ${JSON.stringify(values)}`);
    }
    if (item.route === 'review')
      expect(await page.locator('.review-bars').count() === 0, 'Review rendered numerical result bars without required site data');
    expect(sitesRequested(requests).includes(targetFile), `${item.route}: expected failed file ${targetFile} was never requested`);
    await context.close();
  }
  return 'Home, Learn and Review keep explanatory content, surface a settled data error, and suppress unavailable metrics';
});

await check('idle prefetch failure for an unselected site does not poison a valid Compare result', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const selectedDefaults = [manifest.sites[0].id, manifest.sites[1].id];
  const unused = manifest.sites.find((site) => !selectedDefaults.includes(site.id));
  const targetPath = pathFor(unused.id);
  const siteStarts = [];
  const siteResponses = [];
  const requests = instrument(page, 'idle-unused-site-failure', {
    ignoreConsoleErrors: (text) => /503 \(Service Unavailable\)/.test(text),
    onSiteRequest: (event) => siteStarts.push(event),
    onSiteResponse: (event) => siteResponses.push(event),
    intercept: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith(targetPath)) {
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'unused point unavailable' });
        return;
      }
      await route.continue();
    },
  });
  await open(page, 'compare');
  await routeDataSettled(page);
  const a = await page.locator('#site').inputValue();
  const b = await page.locator('#alternative').inputValue();
  expect(![a, b].includes(unused.id), `test point ${unused.id} is unexpectedly selected (${a}, ${b})`);
  const failed = await page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith(targetPath) && response.status() === 503;
  }, { timeout: 25000 });
  expect(failed.status() === 503, 'idle prefetch did not exercise the injected failure');
  await page.waitForTimeout(300);
  expect(await page.locator('.data-status').count() === 0, 'an unrelated prefetch failure replaced the ready route with a global error');
  expect(await page.locator('.answer-scenario').count() === 3, 'valid three-scenario result disappeared after an unrelated point failed');
  const buttons = page.locator('.comparison-export button');
  expect(await buttons.count() === 2, 'Compare exports disappeared after an unrelated point failed');
  expect(await buttons.nth(0).isEnabled() && await buttons.nth(1).isEnabled(), 'exports were disabled by an unrelated point failure');
  expect(sitesRequested(requests).includes(targetPath), `did not request unused point ${targetPath}`);
  const targetStart = siteStarts.find((event) => event.path === targetPath);
  const targetResponse = siteResponses.find((event) => event.path === targetPath && event.status === 503);
  expect(targetStart && targetResponse, 'missing timing evidence for the injected idle-prefetch failure');
  const laterPrefetchStart = siteStarts.find((event) => event.at > targetStart.at && ![pathFor(a), pathFor(b)].includes(event.path));
  if (laterPrefetchStart) expect(laterPrefetchStart.at >= targetResponse.at, 'another unselected site request started before the failed prefetch settled');
  await context.close();
  return `${unused.id} failed during idle prefetch; selected points ${a}/${b} remained ready/exportable; serial starts=${siteStarts.map((e) => `${e.path}@${e.at}`).join(', ')}`;
});

await check('all versioned dataset requests stay pinned to the manifest version', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const requests = instrument(page, 'version-pinning');
  await open(page, 'simulator');
  await page.waitForFunction(() => !!document.querySelector('canvas')?.lunarSnapshot?.()?.rendered?.ready, null, { timeout: 30000 });
  const jsonData = requests.filter((request) => request.path.endsWith('.json'));
  const unversioned = jsonData.filter((request) => request.path !== 'manifest.json' && !request.path.startsWith('globe/') && request.version !== manifest.generatedAtUtc);
  expect(unversioned.length === 0, `requests mixed versions or omitted the manifest pin: ${JSON.stringify(unversioned)}`);
  const siteIds = unique(sitesRequested(requests).map((path) => manifest.sites.find((site) => site.file === path)?.id).filter(Boolean));
  expect(siteIds.length === 1, `Simulator fetched more than its active site before background prefetch: ${JSON.stringify(siteIds)}`);
  const report = { manifestVersion: manifest.generatedAtUtc, jsonRequests: jsonData, siteIds };
  await context.close();
  return JSON.stringify(report);
});

const passed = checks.filter((item) => item.ok).length;
const summary = { base: BASE, browser: browser.version(), manifestVersion: manifest.generatedAtUtc, checks, passed, failed: checks.length - passed, errors };
writeFileSync(join(OUT, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);
await browser.close();
if (summary.failed || errors.length) process.exitCode = 1;
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, errors: errors.length, output: join(OUT, 'results.json') }));
