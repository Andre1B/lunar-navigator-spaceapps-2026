// Focused route, Learn geometry, intro, credits retry and clearance-chart QA.
// Run against a current local preview without relying on a dedicated GPU:
//   $env:QA_URL='http://localhost:4173'; node tests/browser-check-current-pages.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.QA_URL || 'http://localhost:4173').replace(/\/$/, '');
const OUT = process.env.QA_OUT
  ? resolve(process.env.QA_OUT)
  : resolve(ROOT, '..', 'tmp', 'lunar-current-pages');
mkdirSync(OUT, { recursive: true });
const results = [], issues = [];
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
console.log('browser', browser.version(), 'base', BASE, 'WebGL=SwiftShader');

function observe(page, tag) {
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push({ tag, type: 'console', text: message.text(), location: message.location().url || '' });
  });
  page.on('pageerror', (error) => issues.push({ tag, type: 'page', text: String(error) }));
  page.on('response', (response) => {
    if (response.status() >= 400) issues.push({ tag, type: 'http', status: response.status(), url: response.url() });
  });
}
async function check(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '', ms: Date.now() - start });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, ok: false, detail: String(error.message || error).split('\n')[0], ms: Date.now() - start });
    console.log('FAIL', name, String(error.message || error).split('\n')[0]);
  }
}
async function context(options = {}) {
  return browser.newContext({ reducedMotion: 'no-preference', ...options });
}
async function route(page, path) {
  const url = path.startsWith('/') ? BASE + path : `${BASE}/#/${path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const root = path === '/demo/' ? page.locator('#deck') : page.locator('main').first();
  await root.waitFor({ timeout: 30000 });
  if (path !== '/demo/' && path !== '/summary.html') {
    const opening = page.getByRole('dialog', { name: 'Lunacline' });
    if (await opening.count()) {
      const skip = opening.getByRole('button', { name: /Skip intro/ });
      await skip.click();
      await opening.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }
  await page.waitForTimeout(path === 'simulator' ? 900 : 250);
  return root;
}

await check('all routes render on mobile and desktop without overflow or misplaced footer', async () => {
  const paths = [
    ['home', /Land a week late/i],
    ['compare', /What does a landing delay change/i],
    ['simulator', /See the sky behind the comparison/i],
    ['learn', /How Lunacline works/i],
    ['review', /If a Moon landing is delayed/i],
    ['mission', /Set up the observation/i],
    ['evidence', /Show your work/i],
    ['credits', /Built with open knowledge/i],
    ['/demo/', /When the landing date slips/i],
    ['/summary.html', /Find a window\. Explain your decision/i],
  ];
  const reports = [];
  for (const [label, heading] of paths) {
    for (const [sizeName, viewport, touch] of [
      ['desktop', { width: 1440, height: 900 }, false],
      ['mobile', { width: 390, height: 844 }, true],
    ]) {
      const ctx = await context({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 1 : 1 });
      const page = await ctx.newPage();
      observe(page, `${label}-${sizeName}`);
      const root = await route(page, label);
      await page.evaluate(() => document.fonts?.ready);
      const metrics = await page.evaluate(() => {
        const main = document.querySelector('main, #deck');
        const h1 = main?.querySelector('h1');
        const footer = document.querySelector('footer.footer[role="contentinfo"], footer.footer');
        const mr = main?.getBoundingClientRect();
        const fr = footer?.getBoundingClientRect();
        const canvas = document.querySelector('canvas');
        return {
          title: document.title,
          heading: h1?.innerText?.replace(/\s+/g, ' ').trim() || '',
          textLength: main?.innerText?.trim().length || 0,
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          mainHeight: mr?.height || 0,
          // The standalone summary has an in-content footer, not the app-shell footer.
          footerAfterMain: location.pathname === '/summary.html' || !footer || !main || fr.top + scrollY >= mr.bottom + scrollY - 1,
          canvas: canvas ? { width: canvas.clientWidth, height: canvas.clientHeight, ready: canvas.lunarSnapshot?.().rendered?.ready ?? null } : null,
        };
      });
      expect(metrics.width === viewport.width, `${label}/${sizeName}: actual viewport ${metrics.width}`);
      expect(metrics.scrollWidth <= viewport.width + 1, `${label}/${sizeName}: horizontal overflow ${metrics.scrollWidth}/${viewport.width}`);
      expect(metrics.mainHeight > 100 && metrics.textLength > 60, `${label}/${sizeName}: empty or collapsed content ${JSON.stringify(metrics)}`);
      expect(heading.test(metrics.heading), `${label}/${sizeName}: unexpected heading "${metrics.heading}"`);
      expect(metrics.footerAfterMain, `${label}/${sizeName}: footer overlaps or precedes page content`);
      const file = join(OUT, `${label.replaceAll('/', '-')}-${sizeName}.png`);
      await page.screenshot({ path: file, fullPage: false });
      reports.push({ route: label, viewport: sizeName, ...metrics, screenshot: file });
      await ctx.close();
    }
  }
  const routeTags = new Set(paths.flatMap(([label]) => [`${label}-desktop`, `${label}-mobile`]));
  const routeIssues = issues.filter((issue) => routeTags.has(issue.tag));
  expect(routeIssues.length === 0, `route loads emitted browser/resource errors: ${JSON.stringify(routeIssues)}`);
  return `${reports.length} route/viewport states passed; ${reports.filter((r) => r.canvas?.ready === true).length} simulator canvases reported ready`;
});

await check('Home keeps two loading cards in place, then fills them with real values', async () => {
  const ctx = await context({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  observe(page, 'home-loading');
  await page.route('**/data/**', async (request) => {
    await delay(700);
    await request.continue();
  });
  await page.goto(`${BASE}/?qa=loading#/home`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const opening = page.getByRole('dialog', { name: 'Lunacline' });
  if (await opening.count()) {
    await opening.getByRole('button', { name: /Skip intro/ }).click();
    await opening.waitFor({ state: 'hidden', timeout: 5000 });
  }
  await page.evaluate(() => document.fonts?.ready);
  const cards = page.locator('.delay-briefing .briefing-results article');
  await cards.first().waitFor({ timeout: 20000 });
  const early = await page.evaluate(() => ({
    count: document.querySelectorAll('.delay-briefing .briefing-results article').length,
    numbers: [...document.querySelectorAll('.delay-briefing .hl-num')].map((e) => e.innerText.trim()),
    tops: [...document.querySelectorAll('.delay-briefing .briefing-results article')].map((e) => {
      const hero = document.querySelector('.hl-hero').getBoundingClientRect();
      return e.getBoundingClientRect().top - hero.top;
    }),
  }));
  expect(early.count === 2 && early.numbers.length === 2 && early.numbers.every((n) => n === '–'), `loading state must retain two dash cards: ${JSON.stringify(early)}`);
  await page.screenshot({ path: join(OUT, 'home-loading.png') });
  await page.waitForFunction(() => {
    const values = [...document.querySelectorAll('.delay-briefing .hl-num')];
    return values.length === 2 && values.every((e) => e.innerText.trim() !== '–' && /\d/.test(e.innerText));
  }, null, { timeout: 30000 });
  const settled = await page.evaluate(() => ({
    count: document.querySelectorAll('.delay-briefing .briefing-results article').length,
    numbers: [...document.querySelectorAll('.delay-briefing .hl-num')].map((e) => e.innerText.trim()),
    tops: [...document.querySelectorAll('.delay-briefing .briefing-results article')].map((e) => {
      const hero = document.querySelector('.hl-hero').getBoundingClientRect();
      return e.getBoundingClientRect().top - hero.top;
    }),
  }));
  expect(settled.count === 2 && settled.numbers.every((n) => n !== '–'), `loading never resolved to the two computed cards: ${JSON.stringify(settled)}`);
  expect(early.tops.every((y, i) => Math.abs(y - settled.tops[i]) <= 2), `data arrival moved the two cards vertically: ${JSON.stringify({ early, settled })}`);
  await page.screenshot({ path: join(OUT, 'home-loaded.png') });
  await ctx.close();
  return `${early.numbers.join('/')} → ${settled.numbers.join('/')}; card top movement ≤2 px`;
});

await check('Learn copy and Raise the observer SVG agree at the 1.80439 threshold', async () => {
  const ctx = await context({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  observe(page, 'learn-raise');
  await route(page, 'learn');
  await page.getByRole('button', { name: /Step 3: Set the arrival and the window/ }).click();
  await page.locator('details.learn-details').evaluateAll((elements) => elements.forEach((element) => { element.open = true; }));
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  for (const phrase of ['What is it?', '0.5, 1, 2, 5 and 10 m', 'rolling period of about one year before and after', 'refined to about 1 minute', 'upstream source and license'])
    expect(text.toLowerCase().includes(phrase.toLowerCase()), `Learn is missing required copy: ${phrase}`);
  const slider = page.locator('#raise .learn-sim input[type="range"]');
  await slider.waitFor();
  const setHeight = async (height) => {
    await slider.evaluate((e, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, String(value));
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }, height);
    await page.waitForFunction((value) => Number(document.querySelector('#raise .learn-sim input[type="range"]').value) === value, height, { timeout: 3000 });
  };
  const inspect = () => page.evaluate(() => {
    const box = document.querySelector('.learn-sim');
    const svg = box.querySelector('svg');
    const points = svg.querySelector('polygon.learn-ground').getAttribute('points').trim().split(/\s+/).map((point) => point.split(',').map(Number));
    const [crestX, crestY] = points[2];
    const eye = svg.querySelector('.learn-eye');
    const eyeX = Number(eye.getAttribute('cx')), eyeY = Number(eye.getAttribute('cy'));
    const sun = svg.querySelector('.learn-sun');
    const sunX = Number(sun.getAttribute('cx')), sunY = Number(sun.getAttribute('cy'));
    const line = svg.querySelector('.learn-ray.blocked, .learn-ray.ok');
    const x2 = Number(line.getAttribute('x2')), y2 = Number(line.getAttribute('y2'));
    const fullRayY = eyeY + (crestX - eyeX) * ((sunY - eyeY) / (sunX - eyeX));
    return { result: box.querySelector('.learn-result').innerText, svgLabel: svg.getAttribute('aria-label'), lineClass: line.getAttribute('class'), eyeX, eyeY, crestX, crestY, sunX, sunY, fullRayY, x2, y2 };
  });
  for (const [height, visible] of [[1.7, false], [1.8, false], [1.9, true], [2.0, true]]) {
    await setHeight(height);
    const state = await inspect();
    expect(state.result.startsWith(visible ? 'Visible.' : 'Hidden.'), `height ${height}: verdict ${state.result}`);
    expect(state.lineClass.includes(visible ? 'ok' : 'blocked'), `height ${height}: SVG line class ${state.lineClass}`);
    expect((state.fullRayY < state.crestY) === visible, `height ${height}: Sun ray/crest contradiction ${JSON.stringify(state)}`);
    if (!visible) {
      expect(state.x2 >= state.crestX - 50 - 1e-6 && state.x2 <= state.crestX + 1e-6, `height ${height}: blocked red segment misses ridge flank ${JSON.stringify(state)}`);
      expect(state.y2 >= 82 - 1e-6 && state.y2 <= 130 + 1e-6, `height ${height}: blocked red segment misses the ridge profile ${JSON.stringify(state)}`);
    }
  }
  await page.screenshot({ path: join(OUT, 'learn-raise-2m.png') });
  await ctx.close();
  return 'copy covers comparison-first purpose, five heights, rolling period, event refinement and upstream licenses; 1.7/1.8 hidden, 1.9/2.0 visible with matching ray geometry';
});

await check('Learn walkthrough step 4 keeps its action and caption attached at desktop and mobile widths', async () => {
  const reports = [];
  for (const [label, viewport, touch] of [
    ['desktop', { width: 1440, height: 900 }, false],
    ['mobile', { width: 390, height: 844 }, true],
  ]) {
    const ctx = await context({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    observe(page, `learn-step4-${label}`);
    await route(page, 'learn');
    const widget = page.locator('.animated-explainer');
    await widget.getByRole('button', { name: /4 Read a duration, then inspect it/ }).click();
    await page.waitForFunction(() => document.querySelector('.animated-explainer .explainer-count')?.textContent.trim() === '04 / 04');
    const layout = await widget.evaluate((root) => {
      const rect = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
      const stage = root.querySelector('.explainer-stage'), steps = root.querySelector('.explainer-steps'), caption = root.querySelector(':scope > p.caption');
      const action = root.querySelector('.explainer-copy button'), buttons = [...root.querySelectorAll('.explainer-steps button')];
      return { stage: rect(stage), steps: rect(steps), caption: rect(caption), action: rect(action), captionText: caption.innerText, captionFont: getComputedStyle(caption).fontSize, stepButtons: buttons.map(rect), viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, heading: root.querySelector('.explainer-copy h3')?.innerText, actionText: action.innerText };
    });
    expect(layout.heading === 'Read a duration, then inspect it' && /Original 2D illustration/.test(layout.captionText) && layout.actionText.includes('Check the evidence'), `${label}: step 4 content/action changed: ${JSON.stringify(layout)}`);
    expect(layout.caption.top >= layout.steps.bottom && layout.caption.top - layout.steps.bottom >= 7, `${label}: caption is not spaced below step buttons: ${JSON.stringify(layout)}`);
    expect(Number.parseFloat(layout.captionFont) >= 12, `${label}: caption is too small: ${layout.captionFont}`);
    expect(layout.scrollWidth <= layout.viewport + 1 && [layout.stage, layout.steps, layout.caption, layout.action, ...layout.stepButtons].every((r) => r.left >= -1 && r.right <= layout.viewport + 1), `${label}: explainer content is clipped or overflows: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: join(OUT, `learn-step4-${label}.png`) });
    reports.push(`${label}: caption ${layout.captionFont}, gap ${(layout.caption.top - layout.steps.bottom).toFixed(1)} px`);
    await ctx.close();
  }
  return reports.join('; ');
});

await check('Compare clearance chart keyboard, zoom, touch tap/pan and vertical scrolling work', async () => {
  const desktop = await context({ viewport: { width: 1440, height: 900 } });
  const dp = await desktop.newPage();
  observe(dp, 'clearance-desktop');
  await route(dp, 'compare');
  const chart = dp.locator('.hl-clearance svg.chart-interactive');
  await chart.waitFor({ timeout: 30000 });
  const readout = dp.locator('.hl-clearance .chart-readout');
  await chart.focus();
  await dp.keyboard.press('ArrowRight');
  const oneHour = await readout.innerText();
  expect(oneHour.includes('(hour 1 after arrival)') && /[+-]?\d+\.\d+° at \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/.test(oneHour), `keyboard readout lacks degrees and UTC: ${oneHour}`);
  await dp.keyboard.press('Shift+ArrowRight');
  expect((await readout.innerText()).includes('(hour 25 after arrival)'), `Shift+ArrowRight did not move one day: ${await readout.innerText()}`);
  const windowText = () => dp.locator('.hl-clearance [aria-label="Chart view"] .chart-window').innerText();
  const full = await windowText();
  await dp.keyboard.press('+');
  const zoomed = await windowText();
  expect(zoomed !== full, 'plus did not zoom the time window');
  await dp.keyboard.press('-');
  expect((await windowText()) !== zoomed, 'minus did not zoom back out');
  await dp.keyboard.press('0');
  expect((await windowText()) === full, '0 did not reset the chart window');
  await dp.locator('.hl-clearance [aria-label="Chart view"]').getByRole('button', { name: 'Zoom in', exact: true }).click();
  const beforeWheel = await windowText();
  await chart.scrollIntoViewIfNeeded();
  const clearanceScrollBefore = await dp.evaluate(() => scrollY);
  await chart.evaluate((element) => {
    window.__qaChartWheelCount = 0;
    element.addEventListener('wheel', () => { window.__qaChartWheelCount++; }, { capture: true });
  });
  const box = await chart.boundingBox();
  await dp.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await dp.waitForTimeout(100);
  const settledBox = await chart.boundingBox();
  await dp.mouse.move(settledBox.x + settledBox.width / 2, settledBox.y + settledBox.height / 2);
  await dp.waitForTimeout(80);
  await dp.mouse.wheel(0, 120);
  await dp.waitForFunction((value) => document.querySelector('.hl-clearance [aria-label="Chart view"] .chart-window').innerText !== value, beforeWheel, { timeout: 3000 }).catch(async (error) => {
    const diagnostics = await dp.evaluate(() => ({ wheelEvents: window.__qaChartWheelCount, window: document.querySelector('.hl-clearance [aria-label="Chart view"] .chart-window')?.innerText }));
    throw new Error(`wheel did not change the zoomed chart window (${beforeWheel}); ${JSON.stringify(diagnostics)}; ${error.message}`);
  });
  expect(await dp.evaluate(() => scrollY) === clearanceScrollBefore, 'zoomed clearance wheel scrolled the document');
  expect((await windowText()) !== beforeWheel, `wheel did not change the zoomed chart window (${beforeWheel})`);
  const horizon = dp.locator('.hl-horizon svg.chart-interactive');
  await horizon.waitFor({ timeout: 15000 });
  await horizon.scrollIntoViewIfNeeded();
  const horizonWindow = () => dp.locator('.hl-horizon [aria-label="Sky path view"] .chart-window').innerText();
  const horizonStart = await horizonWindow();
  await dp.locator('.hl-horizon [aria-label="Sky path view"]').getByRole('button', { name: 'Zoom in', exact: true }).click();
  const horizonZoomed = await horizonWindow();
  expect(horizonZoomed !== horizonStart, 'sky-path Zoom in did not narrow azimuth');
  const horizonScrollBefore = await dp.evaluate(() => scrollY);
  const horizonBox = await horizon.boundingBox();
  await dp.mouse.move(horizonBox.x + horizonBox.width * 0.5, horizonBox.y + horizonBox.height * 0.5);
  await dp.mouse.wheel(0, 120);
  await dp.waitForFunction((value) => document.querySelector('.hl-horizon [aria-label="Sky path view"] .chart-window').innerText !== value, horizonZoomed, { timeout: 3000 });
  expect(await dp.evaluate(() => scrollY) === horizonScrollBefore, 'zoomed sky-path wheel scrolled the document');
  const horizonBeforePan = await horizonWindow();
  const panBox = await horizon.boundingBox(), panY = panBox.y + panBox.height * 0.5;
  await dp.mouse.move(panBox.x + panBox.width * 0.6, panY);
  await dp.mouse.down();
  await dp.mouse.move(panBox.x + panBox.width * 0.4, panY, { steps: 5 });
  await dp.mouse.up();
  expect(await horizonWindow() !== horizonBeforePan, 'sky-path horizontal drag did not pan azimuth');
  await dp.locator('.hl-horizon [aria-label="Sky path view"]').getByRole('button', { name: 'Reset', exact: true }).click();
  expect(await horizonWindow() === horizonStart, 'sky-path Reset did not restore the original azimuth window');
  await dp.screenshot({ path: join(OUT, 'compare-clearance-desktop.png') });
  await desktop.close();

  const mobile = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mp = await mobile.newPage();
  observe(mp, 'clearance-mobile');
  await route(mp, 'compare');
  const mchart = mp.locator('.hl-clearance svg.chart-interactive');
  await mchart.waitFor({ timeout: 30000 });
  await mchart.scrollIntoViewIfNeeded();
  await mp.locator('.hl-clearance [aria-label="Chart view"]').getByRole('button', { name: 'Zoom in', exact: true }).click();
  const mobileWindow = () => mp.locator('.hl-clearance [aria-label="Chart view"] .chart-window').innerText();
  const beforeDrag = await mobileWindow();
  const bounds = await mchart.boundingBox();
  const cdp = await mobile.newCDPSession(mp);
  const midX = bounds.x + bounds.width * 0.55, midY = bounds.y + bounds.height * 0.5;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: midX, y: midY }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.waitForTimeout(120);
  expect(/\(hour \d+ after arrival\)/.test(await mp.locator('.hl-clearance .chart-readout').innerText()), 'touch tap did not set the exact UTC readout');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: midX + 35, y: midY }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: midX - 35, y: midY }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: midX - 70, y: midY }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.waitForTimeout(180);
  const afterDrag = await mobileWindow();
  expect(afterDrag !== beforeDrag, `horizontal touch drag did not pan the chart (${beforeDrag} -> ${afterDrag})`);
  await mchart.scrollIntoViewIfNeeded();
  const verticalBounds = await mchart.boundingBox(), scrollBefore = await mp.evaluate(() => scrollY);
  const scrollX = verticalBounds.x + verticalBounds.width / 2, scrollYStart = verticalBounds.y + Math.max(40, verticalBounds.height * 0.65);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 2, x: scrollX, y: scrollYStart }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 2, x: scrollX, y: scrollYStart - 80 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.waitForTimeout(200);
  const scrollAfter = await mp.evaluate(() => scrollY);
  expect(scrollAfter > scrollBefore + 5, `vertical touch gesture did not scroll the page (${scrollBefore} -> ${scrollAfter})`);
  expect(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Compare chart overflows at 390 px');
  await mp.screenshot({ path: join(OUT, 'compare-clearance-mobile.png') });
  const chartErrors = issues.filter((issue) => issue.tag === 'clearance-desktop' || issue.tag === 'clearance-mobile');
  expect(chartErrors.length === 0, `clearance interactions emitted browser errors: ${JSON.stringify(chartErrors)}`);
  await mobile.close();
  return `keyboard hour/day readout; +/−/0 and Ctrl+wheel zoom; mobile tap, horizontal pan and vertical page scroll passed`;
});

await check('Compare lazily loads 3D-only data and restores exact chart inspection settings', async () => {
  const ctx = await context({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const dataRequests = [];
  page.on('request', request => {
    if (/\/data\/(?:sky|planets)\.json(?:\?|$)/.test(request.url())) dataRequests.push(new URL(request.url()).pathname);
  });
  observe(page, 'compare-inspection');
  await page.goto(`${BASE}/?qa=1#/compare`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const opening = page.getByRole('dialog', { name: 'Lunacline' });
  if (await opening.count()) {
    await opening.getByRole('button', { name: /Skip intro/ }).click();
    await opening.waitFor({ state: 'hidden', timeout: 5000 });
  }
  await page.locator('main').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(400);
  await page.locator('.answer-scenario').first().waitFor({ timeout: 20000 });
  expect(await page.locator('.arrival-series').count() === 0, 'ArrivalSeries mounted before opening its disclosure');
  expect(dataRequests.length === 0, `Compare fetched 3D-only data before mounting the 3D view: ${dataRequests.join(', ')}`);

  const original = await page.evaluate(() => Object.fromEntries(['#site', '#alternative', '#height', '#arrival', '#days', '#delay', '#delay-hours'].map(selector => [selector, document.querySelector(selector)?.value ?? null])));
  const cardsBefore = (await page.locator('.answer-scenario').allTextContents()).map(text => text.replace(/\s+/g, ' ').trim());
  const chart = page.locator('.hl-clearance svg.chart-interactive');
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  const readout = await page.locator('.hl-clearance .chart-readout').innerText();
  const group = page.getByRole('group', { name: 'Inspect this instant in 3D' });
  await group.waitFor();
  const buttons = await group.getByRole('button').allTextContents();
  expect(buttons.length === 3 && buttons.every(text => /^(A|B|C) · \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(text.trim())), `inspection actions do not name each scenario and UTC: ${JSON.stringify(buttons)}`);
  const selected = buttons[0].trim();
  const utc = selected.slice(4, -4);
  expect(readout.includes(utc), `scenario button UTC ${utc} does not match the chart readout: ${readout}`);
  const target = await page.evaluate(async (value) => {
    const manifest = await (await fetch('/data/manifest.json', { cache: 'no-store' })).json();
    const instant = Date.parse(`${value.replace(' ', 'T')}:00Z`);
    return {
      index: (instant - Date.parse(manifest.period.startUtc)) / (manifest.period.stepMinutes * 60_000),
      start: manifest.period.startUtc,
    };
  }, utc);
  await group.getByRole('button', { name: selected, exact: true }).click();
  await page.waitForFunction(() => location.hash.startsWith('#/simulator'), null, { timeout: 10000 });
  await page.locator('.inspection-note').waitFor({ timeout: 15000 });
  await page.waitForFunction(({ index }) => {
    const snap = document.querySelector('canvas')?.lunarSnapshot?.();
    return snap?.rendered?.ready && Math.abs(snap.index - index) < 0.03 && Math.abs(snap.rendered.presentedIndex - index) < 0.03;
  }, { index: target.index }, { timeout: 20000 });
  const note = (await page.locator('.inspection-note').innerText()).replace(/\s+/g, ' ').trim();
  const inspected = await page.evaluate(() => ({ site: document.querySelector('#explorer-site')?.value, height: document.querySelector('#explorer-height')?.value }));
  expect(inspected.site === original['#site'] && inspected.height === original['#height'], `3D inspection did not use the selected scenario's point and height: ${JSON.stringify({ inspected, original })}`);
  expect(/original location and dates are preserved/i.test(note), `inspection note omits preservation context: ${note}`);
  expect(dataRequests.some(path => path.endsWith('/sky.json')) && dataRequests.some(path => path.endsWith('/planets.json')), `3D view did not fetch its deferred data: ${dataRequests.join(', ')}`);
  await page.getByRole('link', { name: /Return to your comparison/ }).click();
  await page.waitForFunction(() => location.hash.startsWith('#/compare'), null, { timeout: 10000 });
  await page.locator('.answer-scenario').first().waitFor({ timeout: 15000 });
  const restored = await page.evaluate(() => Object.fromEntries(['#site', '#alternative', '#height', '#arrival', '#days', '#delay', '#delay-hours'].map(selector => [selector, document.querySelector(selector)?.value ?? null])));
  const cardsAfter = (await page.locator('.answer-scenario').allTextContents()).map(text => text.replace(/\s+/g, ' ').trim());
  expect(JSON.stringify(restored) === JSON.stringify(original), `Compare settings changed across inspection: ${JSON.stringify({ original, restored })}`);
  expect(JSON.stringify(cardsAfter) === JSON.stringify(cardsBefore), 'Compare answer cards changed after returning from inspection');
  expect(await page.locator('.arrival-series').count() === 0, 'ArrivalSeries should remain unmounted after returning when its disclosure was never opened');
  const errors = issues.filter(issue => issue.tag === 'compare-inspection');
  expect(errors.length === 0, `inspection flow emitted browser errors: ${JSON.stringify(errors)}`);
  await ctx.close();
  return `lazy 3D data loads only on simulator mount; UTC ${utc} was rendered at sample ${target.index}; site/height and Compare settings survived the round-trip`;
});

await check('Evidence pipeline, Review order/bars, and Credits failure/retry match the current explanations', async () => {
  const ctx = await context({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  observe(page, 'evidence-review-credits');
  await route(page, 'evidence?metric=solar');
  const pipeline = page.locator('ol.pipeline[aria-label="How a result is computed"]');
  expect(await pipeline.locator('li').count() === 4, 'Evidence pipeline must have four steps');
  const evidenceText = await pipeline.innerText();
  const methodText = await page.locator('main').innerText();
  expect(/Earth as an opaque sphere/.test(evidenceText) && /solar eclipses seen from the Moon count as dark/i.test(methodText), 'Evidence omits the Earth-occultation convention in the method');
  await page.screenshot({ path: join(OUT, 'evidence-desktop.png') });

  await route(page, 'review');
  const nav = page.locator('.review-jumps a');
  expect((await nav.nth(0).innerText()).trim() === 'Compare arrival times', 'Review comparison link must be first');
  expect((await nav.nth(2).innerText()).trim() === 'Optional: see it in 3D', 'Review 3D link must be labeled optional');
  const titles = await page.locator('.review-bars figcaption').allInnerTexts();
  expect(titles.length >= 2 && /Sun/i.test(titles[0]) && /Earth/i.test(titles[1]), `Review must lead with Sun and Earth percentages: ${JSON.stringify(titles)}`);
  const darkValues = await page.locator('.review-results article dl div:nth-child(2) dd').allInnerTexts();
  const needsDarkBars = darkValues.some((value) => /[1-9]/.test(value));
  expect(titles.some((title) => /dark|without/i.test(title)) === needsDarkBars, `dark-hours bar visibility does not match the computed positive values: ${JSON.stringify({ titles, darkValues })}`);
  await page.screenshot({ path: join(OUT, 'review-desktop.png') });

  await page.route('**/credits.json', async (request) => {
    await delay(300);
    await request.abort();
  });
  await route(page, 'credits');
  const error = page.getByRole('alert');
  await error.waitFor({ timeout: 10000 });
  expect(await error.getByText('CREDITS.md', { exact: false }).count() > 0, 'credits error omits the CREDITS.md fallback');
  expect(await error.getByRole('button', { name: 'Try again', exact: true }).count() === 1, 'credits error omits Retry');
  await page.screenshot({ path: join(OUT, 'credits-error.png') });
  await page.unroute('**/credits.json');
  await error.getByRole('button', { name: 'Try again', exact: true }).click();
  const creditSummary = page.locator('details.credit-details summary');
  await page.waitForFunction(() => /^All \d+ projects with licenses and sources$/.test(document.querySelector('details.credit-details summary')?.textContent?.trim() || ''), null, { timeout: 20000 });
  expect(/^All \d+ projects with licenses and sources$/.test((await creditSummary.innerText()).trim()), `credits retry did not restore full list: ${await creditSummary.innerText()}`);
  expect((await page.locator('main').innerText()).includes('Sources at a glance'), 'Credits omits its grouped source summary');
  await page.screenshot({ path: join(OUT, 'credits-recovered.png') });
  const expectedAbort = issues.filter((issue) => issue.tag === 'evidence-review-credits' && issue.type === 'console' && issue.text.includes('net::ERR_FAILED'));
  expect(expectedAbort.length === 1, `credits forced-abort should produce one expected network failure, got ${JSON.stringify(expectedAbort)}`);
  for (let i = issues.length - 1; i >= 0; i--) if (expectedAbort.includes(issues[i])) issues.splice(i, 1);
  await ctx.close();
  return `four Evidence pipeline steps include Earth occultation; Review orders Compare first and conditionally shows dark bars; aborted credits fetch shows CREDITS.md/Retry and then recovers`;
});

const summary = {
  base: BASE,
  browser: browser.version(),
  results,
  issues,
  evidenceDirectory: OUT,
};
writeFileSync(join(OUT, 'results.json'), JSON.stringify(summary, null, 2));
await browser.close();
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks passed. Output: ${OUT}`);
if (results.some((r) => !r.ok) || issues.length) process.exitCode = 1;
