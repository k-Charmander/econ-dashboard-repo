// 대시보드(index.html)를 헤드리스 Chromium으로 PNG 렌더링.
// 사용: node scripts/render.mjs   (Playwright + chromium 필요 — SessionStart 훅이 설치)
// 산출: renders/mockup-dark.png, renders/mockup-light.png
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
// Playwright는 전역 설치본일 수 있으므로 견고하게 resolve
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const groot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(path.join(groot, 'playwright')));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = 'file://' + path.join(root, 'index.html');
const outDir = path.join(root, 'renders');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));

await page.goto(file, { waitUntil: 'networkidle' });

async function shot(theme, out) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    if (window.rebuildAllCharts) window.rebuildAllCharts();
  }, theme);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, out), fullPage: true });
  console.log('wrote', path.join('renders', out));
}

await shot('dark', 'mockup-dark.png');
await shot('light', 'mockup-light.png');

console.log('CONSOLE_ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
if (errors.length) process.exit(1);
