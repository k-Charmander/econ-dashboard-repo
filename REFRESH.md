# 🔄 대시보드 정기 갱신 운영 가이드

세계 5대 경제권 대시보드(`index.html`)를 **공신력 출처 데이터로 갱신**하는 절차와
**정기 갱신(매주 월·수·금) 스케줄** 설정 방법.

## 운영 모델
실시간 API 연동 전까지는 **온디맨드/스케줄 갱신** 방식으로 운영한다.
세션(수동 호출 또는 예약 트리거)에서 아래 절차를 수행 → 대시보드 이미지 산출.

## 갱신 절차 (Refresh Runbook)
Claude 세션에서 **"대시보드 업데이트해줘"** 호출 시 수행하는 표준 절차:

1. **데이터 수집** — 각 지표를 공신력 출처에서 웹 검색으로 조회:
   | 지표 | 출처 |
   |---|---|
   | 유가(WTI) | EIA · NYMEX |
   | 투자공포지수(VIX) | CBOE |
   | 달러인덱스(DXY) | ICE |
   | CPI(YoY) | BLS(미) · Eurostat(유로) · NBS(중) · 일본 총무성 · 통계청(한) |
   | 실업률 | BLS · Eurostat · OECD · 일본 총무성 · 통계청 |
   | 대표지수 | 각국 거래소 (S&P500·CSI300·EuroStoxx50·Nikkei225·KOSPI) |
   | 환율 | ECB · 한국은행 · CFETS |
   | 정책금리 | Fed · PBoC · ECB · BOJ · BOK |
2. **반영** — `index.html` 내 `DATA` 객체의 해당 값/시계열/`src` 갱신,
   헤더 `#updated-time`·푸터 출처 기준일 갱신.
3. **렌더링** — `node scripts/render.mjs` → `mockup-dark.png`, `mockup-light.png`.
   (콘솔 에러 0 확인)
4. **공유/커밋** — 이미지 전송 후 변경 커밋·푸시.

## 렌더링 사전 준비 (세션 1회)
`scripts/render.mjs`는 Playwright + Chromium이 필요하다. 새 컨테이너에서는 1회 설치:
```bash
# Chart.js 로컬 번들(없을 때만): npm registry에서 추출
[ -s assets/chart.umd.min.js ] || { \
  curl -sSL -o /tmp/c.tgz https://registry.npmjs.org/chart.js/-/chart.js-4.4.3.tgz && \
  tar xzf /tmp/c.tgz -C /tmp package/dist/chart.umd.js && \
  cp /tmp/package/dist/chart.umd.js assets/chart.umd.min.js; }

# Chromium 설치 후 렌더링
playwright install chromium
node scripts/render.mjs
```
> 매 세션 자동 준비를 원하면 `.claude` SessionStart 훅으로 자동화할 수 있다(선택).

## 정기 갱신 스케줄 설정 (매주 월·수·금)
정기 갱신은 **Claude Code on the web의 예약 트리거(Scheduled trigger)** 로 설정한다.
(세션 내부에서 플랫폼 스케줄을 직접 만들 수는 없으므로 웹 앱에서 1회 설정)

**설정 값**
- **반복:** 매주 **월요일 · 수요일 · 금요일** (원하는 KST 시각, 예: 08:00)
- **저장소/브랜치:** `k-charmander/econ-dashboard-repo` · `claude/economic-dashboard-mockup-6a4sl2`
- **프롬프트:**
  ```
  REFRESH.md의 갱신 절차에 따라 대시보드를 최신 공신력 데이터로 업데이트하고,
  mockup-dark.png / mockup-light.png 를 렌더링해서 이미지로 보여줘. 변경은 커밋·푸시.
  ```

자세한 설정 방법: https://code.claude.com/docs/en/claude-code-on-the-web

> ⚠️ 모든 데이터는 공개 발표 수치 기반이며 발표 주기상 "호출 시점의 최신치"다.
> 투자 판단의 단독 근거로 사용하지 말 것.
