// council/council-dashboard.jsx(React+recharts)를 헤드리스 Chromium으로 PNG 렌더링.
// 사용: npm run render:council   (또는 node scripts/render-council.mjs)
// 산출: council/renders/council-{macro|holdings|strategy}-{dark|light}.png (6장)
//   - react/react-dom/recharts/esbuild + playwright chromium 필요 (SessionStart 훅이 설치)
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import esbuild from 'esbuild';

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
const jsx = path.join(root, 'council', 'council-dashboard.jsx');
const outDir = path.join(root, 'council', 'renders');
fs.mkdirSync(outDir, { recursive: true });

// 임시 빌드 디렉터리에 엔트리/하니스/번들 작성
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'council-render-'));
const entry = path.join(tmp, 'entry.jsx');
fs.writeFileSync(entry, `
import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from ${JSON.stringify(jsx)};
createRoot(document.getElementById("root")).render(React.createElement(Dashboard));
`);
fs.writeFileSync(path.join(tmp, 'harness.html'),
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<style>html,body{margin:0;padding:0}</style></head>' +
  '<body><div id="root"></div><script src="./bundle.js"></script></body></html>');

// react/recharts는 저장소 node_modules에서 resolve (엔트리는 tmp에 있으므로 nodePaths 지정)
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: path.join(tmp, 'bundle.js'),
  nodePaths: [path.join(root, 'node_modules')],
  logLevel: 'warning',
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1380, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));

await page.goto('file://' + path.join(tmp, 'harness.html'), { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const NAVS = [
  { label: '글로벌 지표', key: 'macro' },
  { label: '보유종목', key: 'holdings' },
  { label: '카운실·전략', key: 'strategy' },
];

// 테마 토글: 다크 기본. 토글 버튼은 '모드' 텍스트 포함('☀️ 라이트 모드' / '🌙 다크 모드')
async function setTheme(target) {
  const cur = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모드'));
    // 라이트 모드일 때 버튼은 '다크 모드'(전환용)를 표시
    return b && b.textContent.includes('다크 모드') ? 'light' : 'dark';
  });
  if (cur !== target) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('모드'));
      if (b) b.click();
    });
    await page.waitForTimeout(600);
  }
}

async function gotoPage(label) {
  await page.evaluate((lbl) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(lbl));
    if (b) b.click();
  }, label);
  await page.waitForTimeout(1400); // recharts 애니메이션/레이아웃 안정화
}

for (const theme of ['dark', 'light']) {
  await setTheme(theme);
  for (const n of NAVS) {
    await gotoPage(n.label);
    const out = `council-${n.key}-${theme}.png`;
    await page.screenshot({ path: path.join(outDir, out), fullPage: true });
    console.log('wrote', path.join('council/renders', out));
  }
}

console.log('CONSOLE_ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
if (errors.length) process.exit(1);
