#!/bin/bash
# SessionStart 훅 — Claude Code on the web 세션에서 대시보드 이미지 렌더 도구를 준비.
# 설치: react/react-dom/recharts/esbuild/playwright(npm) + Playwright Chromium 브라우저.
# 목적: "대시보드 업데이트 / 카운실 소집" 요청 시 곧바로 PNG 렌더링·표시가 가능하도록.
set -euo pipefail

# 원격(웹) 세션에서만 실행 — 로컬 개발 환경은 건너뜀
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# CLAUDE_PROJECT_DIR는 하니스가 주입하지만, 수동 실행 대비 저장소 루트로 폴백
cd "${CLAUDE_PROJECT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"}"

# 1) npm 의존성(렌더 도구) 설치 — 컨테이너 캐시 활용 위해 install 사용(ci 아님)
npm install

# 2) index.html 렌더용 Chart.js 로컬 번들(없을 때만)
if [ ! -s assets/chart.umd.min.js ]; then
  curl -sSL -o /tmp/chartjs.tgz https://registry.npmjs.org/chart.js/-/chart.js-4.4.3.tgz \
    && tar xzf /tmp/chartjs.tgz -C /tmp package/dist/chart.umd.js \
    && mkdir -p assets && cp /tmp/package/dist/chart.umd.js assets/chart.umd.min.js
fi

# 3) Playwright Chromium 설치(이미 있으면 빠르게 통과)
./node_modules/.bin/playwright install chromium

echo "session-start: render toolchain ready (npm deps + chromium)"
