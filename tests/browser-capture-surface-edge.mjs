// Static Surface-sky horizon-edge capture for a before/after visual comparison.
// Run on an authorized hardware-GPU window, without forcing SwiftShader:
//   $env:QA_URL='http://localhost:5173'; $env:QA_OUT='../tmp/lunar-edge-A'; node tests/browser-capture-surface-edge.mjs
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.QA_URL || 'http://localhost:5173').replace(/\/$/, '');
const OUT = process.env.QA_OUT ? resolve(process.env.QA_OUT) : resolve(ROOT, '..', 'tmp', 'surface-edge-capture');
const SOURCE_REVISION = process.env.QA_REVISION || '9790e01 (working baseline before surfaceVisual edge patch)';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const launchOptions = [
  { channel: 'chrome', headless: true, args: [] },
  ...(existsSync(EXE) ? [{ executablePath: EXE, headless: true, args: [] }] : []),
  { headless: true, args: [] },
];
let browser;
for (const options of launchOptions) {
  try { browser = await chromium.launch(options); break; } catch {}
}
if (!browser) throw new Error('Chrome/Chromium could not be launched');

const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') errors.push({ type: 'console', text: message.text() }); });
  page.on('pageerror', (error) => errors.push({ type: 'page', text: String(error) }));
  page.on('response', (response) => { if (response.status() >= 400) errors.push({ type: 'http', status: response.status(), url: response.url() }); });
  await page.goto(`${BASE}/?qa=1#/simulator`, { waitUntil: 'networkidle', timeout: 60000 });
  const intro = page.getByRole('dialog', { name: 'Lunacline' });
  if (await intro.count()) await intro.waitFor({ state: 'hidden', timeout: 6000 });
  await page.waitForFunction(() => !!document.querySelector('canvas')?.lunarSnapshot?.(), null, { timeout: 30000 });

  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  const site = page.locator('#explorer-site');
  if (await site.count() && !await site.isVisible()) await page.locator('.setup-toggle').click();
  if (await site.count()) await site.selectOption('connecting-ridge');
  const height = page.locator('#explorer-height');
  if (await height.count()) await height.selectOption('1');
  await page.locator('.camera-presets button').filter({ hasText: 'Surface sky' }).click();
  await page.waitForFunction(() => {
    const snapshot = document.querySelector('canvas')?.lunarSnapshot?.();
    return snapshot?.rendered?.ready && snapshot.rendered.view === 'sky' && snapshot.transition === false;
  }, null, { timeout: 45000 });
  const slider = page.locator('#time-slider');
  await slider.evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(value));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, 8765);
  await page.waitForFunction(() => {
    const snapshot = document.querySelector('canvas')?.lunarSnapshot?.();
    return snapshot?.rendered?.ready && Math.abs(snapshot.index - 8765) < 0.01 && Math.abs(snapshot.rendered.presentedIndex - 8765) < 0.02;
  }, null, { timeout: 15000 });
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => {
    const canvas = document.querySelector('.space-canvas canvas') || document.querySelector('canvas');
    const snapshot = canvas?.lunarSnapshot?.();
    let gl = null;
    try { gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl'); } catch {}
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      canvas: canvas ? {
        cssWidth: canvas.clientWidth,
        cssHeight: canvas.clientHeight,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
        identity: canvas.dataset.followTraceId || null,
      } : null,
      webgl: gl ? {
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        antialiasAttribute: gl.getContextAttributes()?.antialias ?? null,
        samples: gl.getParameter(gl.SAMPLES),
        drawingBuffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight },
      } : null,
      selectedSite: document.querySelector('#explorer-site')?.value ?? null,
      selectedHeightM: Number(document.querySelector('#explorer-height')?.value ?? NaN),
      playback: document.querySelector('.playback-status')?.innerText?.trim() ?? null,
      snapshot,
    };
  });
  if (state.viewport.width !== 1440 || state.viewport.dpr !== 1) throw new Error(`unexpected viewport/DPR: ${JSON.stringify(state.viewport)}`);
  if (state.selectedSite !== 'connecting-ridge' || state.selectedHeightM !== 1) throw new Error(`unexpected site/height: ${state.selectedSite}/${state.selectedHeightM}`);
  if (state.snapshot?.rendered?.view !== 'sky' || Math.abs(state.snapshot.index - 8765) >= 0.01) throw new Error(`unexpected scene state: ${JSON.stringify(state.snapshot?.rendered)}`);

  const screenshot = join(OUT, 'surface-sky-horizon-canvas.png');
  await page.locator('.space-canvas canvas').screenshot({ path: screenshot, timeout: 15000 });
  const report = {
    capturedAt: new Date().toISOString(),
    sourceRevision: SOURCE_REVISION,
    browser: browser.version(),
    args: [],
    state,
    screenshot,
    errors,
  };
  writeFileSync(join(OUT, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ browser: report.browser, sourceRevision: report.sourceRevision, webgl: state.webgl, site: state.selectedSite, heightM: state.selectedHeightM, view: state.snapshot?.rendered?.view, baseIndex: state.snapshot?.index, presentedIndex: state.snapshot?.rendered?.presentedIndex, screenshot, errors }));
  await context.close();
} finally {
  await browser.close();
}
