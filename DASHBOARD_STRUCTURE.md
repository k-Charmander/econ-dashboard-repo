# 📐 경제 대시보드 구조 가이드 (재사용 블루프린트)

이 문서는 본 프로젝트(`index.html`)에서 구축한 **인터랙티브 대시보드 구조**를
다른 프로젝트로 이식·재사용하기 위한 설계 명세다. 레이아웃, 데이터 스키마,
테마 시스템, 차트 패턴, 인터랙션, 이미지 렌더링까지 그대로 가져다 쓸 수 있도록
핵심 코드 패턴을 포함한다.

---

## 1. 설계 원칙

| 원칙 | 내용 |
|---|---|
| **Self-contained 단일 HTML** | HTML/CSS/JS를 한 파일에. 빌드·번들러·프레임워크 불필요 |
| **의존성 최소** | Chart.js 1개만 사용, **로컬 번들**(`assets/chart.umd.min.js`)로 오프라인 동작 + CDN 폴백 |
| **데이터/뷰 분리** | 모든 수치를 단일 `DATA` 객체에 모음 → 데이터만 갈아끼우면 재사용 |
| **CSS 변수 테마** | 색·간격을 `:root` 변수로 → 다크/라이트 토글 & 리브랜딩 용이 |
| **재렌더 가능** | 헤드리스 Chromium 스크립트로 PNG 산출(목업/리포트/공유용) |

---

## 2. 파일 구조

```
프로젝트/
├── index.html                 # 대시보드 본체 (HTML+CSS+JS 인라인)
├── assets/
│   └── chart.umd.min.js        # Chart.js v4 로컬 번들 (npm registry tarball에서 추출)
├── scripts/
│   └── render.mjs              # Playwright 헤드리스 PNG 렌더 (dark/light)
└── (mockup-dark.png / mockup-light.png)  # 렌더 산출물
```

Chart.js 로컬 번들 받기(CDN 차단 환경 대비, npm registry는 보통 허용):
```bash
curl -sSL -o /tmp/c.tgz https://registry.npmjs.org/chart.js/-/chart.js-4.4.3.tgz
tar xzf /tmp/c.tgz -C /tmp package/dist/chart.umd.js
mkdir -p assets && cp /tmp/package/dist/chart.umd.js assets/chart.umd.min.js
```

HTML `<head>`의 로드 + 폴백:
```html
<script src="./assets/chart.umd.min.js"></script>
<script>
  if (typeof Chart === 'undefined') {
    document.write('<scr'+'ipt src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></scr'+'ipt>');
  }
</script>
```

---

## 3. 레이아웃 구성 (위→아래)

```
┌─ Header bar ─ 로고 · 타이틀 · 갱신시각 · 테마토글
├─ Filter tabs ─ 전체/항목별 필터 (pill 버튼)
├─ KPI 카드뷰 ─ 6열 그리드, 카드마다 값·변동·스파크라인·출처
├─ 비교 매트릭스(히트맵) + 게이지(도넛 반원)   [g-2: 1.55fr / 1fr]
├─ 라인차트 2개 (추이)                          [g-2]
├─ 막대차트 3개 (항목 비교)                      [g-3]
├─ 인포그래픽 (신호등 카드 + 흐름 바)            [g-2]
└─ Footnote ─ 출처·기준일·면책
```

핵심 그리드 유틸 클래스:
```css
.grid { display:grid; gap:16px; }
.g-2  { grid-template-columns: 1.55fr 1fr; }
.g-3  { grid-template-columns: repeat(3,1fr); }
.kpi-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; }
/* 반응형: 1180px↓ → g-2/g-3 1열, kpi 3열 / 680px↓ → kpi·signal 2열 */
```

---

## 4. 테마 시스템 (다크/라이트)

모든 색을 CSS 변수로 정의하고 `html[data-theme="dark"]`로 오버라이드.
`localStorage`에 저장, 토글 시 차트도 재생성(차트는 변수색을 캡처하므로).

```css
:root {            /* 라이트 기본값 */
  --bg:#f4f6fb; --panel:#fff; --border:#e3e8f2;
  --text:#1a2233; --text-dim:#5a6478; --accent:#2f6bff;
  --up:#e5484d; --down:#1f8f5f; --warn:#f5a623;     /* 한국식: 상승=빨강, 하락=초록 */
  --shadow:0 1px 3px rgba(20,30,60,.06),0 6px 22px rgba(20,30,60,.05);
  /* 시리즈 색 */ --us:#3b6df0; --cn:#e5484d; --eu:#7b61ff; --jp:#ff8a3d; --kr:#16b07d;
}
html[data-theme="dark"] {
  --bg:#0c1018; --panel:#151b29; --border:#232c3f;
  --text:#e9eef8; --text-dim:#9aa6bd; --accent:#5b8bff;
  --up:#ff5d62; --down:#2ecf86; --warn:#ffb13d;
  /* ... 시리즈 색 다크 버전 ... */
}
```

```js
const root = document.documentElement;
function cssVar(n){ return getComputedStyle(root).getPropertyValue(n).trim(); }
function applyTheme(t){
  root.setAttribute('data-theme', t);
  try{ localStorage.setItem('econ-theme', t);}catch(e){}
}
let theme = 'dark';
try { theme = localStorage.getItem('econ-theme') || 'dark'; } catch(e){}
applyTheme(theme);
themeBtn.addEventListener('click', ()=>{
  theme = root.getAttribute('data-theme')==='dark' ? 'light':'dark';
  applyTheme(theme);
  rebuildAllCharts();   // 차트는 변수색을 다시 읽어야 하므로 재생성
});
```

> **이식 팁:** 리브랜딩은 `:root`의 `--accent`·시리즈색만 바꾸면 끝. 차트는 `cssVar()`로 색을 읽으므로 자동 반영.

---

## 5. 데이터 스키마 — 단일 `DATA` 객체

뷰는 이 객체만 바라본다. **데이터 교체 = 이 객체 교체.**
지표마다 `src`(출처)·단위·시계열을 함께 둔다.

```js
const REGIONS = {
  US:{ name:'미국', en:'United States', flag:'🇺🇸', color:'var(--us)' },
  /* CN, EU, JP, KR ... */
};

const DATA = {
  // (a) KPI 카드: 값+변동+스파크라인+출처. invert=true → 하락이 '좋음'(물가/실업/공포)
  kpi: [
    { id:'wti', label:'WTI 유가', en:'Crude Oil', icon:'🛢️',
      val:'74.8', unit:'USD/bbl', chg:-2.0, src:'EIA·NYMEX · 6/18',
      spark:[88,90,85,80,77,74.8] },
    { id:'vix', label:'투자공포지수', en:'VIX', icon:'😨',
      val:'16.4', unit:'pt', chg:-3.5, src:'CBOE · 6/16', invert:true,
      spark:[31,28,24,22,18,16.4] },
    /* ... */
  ],
  // (b) 히트맵 매트릭스: 행=지표, 열=항목. s=0~100 강도(색), d=표시값
  matrix: [
    { metric:'대표지수', en:'Equity', cells:{ US:{d:'-1.2%',s:35}, JP:{d:'+1.7%',s:82}, /*...*/ } },
    /* ... */
  ],
  // (c) 라인차트 시계열: 정규화(기준=100) 또는 원값. levels=범례에 표기할 현재값
  indices: { labels:['1월',/*...*/], levels:{ US:'7,420', /*...*/ },
             series:{ US:[100,99.2,94.1,103.5,109,106.9], /*...*/ } },
  fx:      { labels:[...], levels:{...}, series:{...} },
  // (d) 막대차트용 단일값 맵
  cpi:  { US:4.2, CN:1.2, EU:3.2, JP:1.4, KR:3.1 },
  emp:  { US:4.3, /*...*/ },
  rate: { US:3.75, /*...*/ },
  vix: 16.4,
  // (e) 신호등 인포그래픽
  signals: { US:{ light:'🟡', verdict:'중립', vEn:'Neutral', note:'...' }, /*...*/ },
  // (f) 흐름 바
  flow: { riskOn:46, riskOff:54,
          bars:[ {k:'주식 Equities', v:50, c:'var(--up)'}, /*...*/ ] }
};
```

---

## 6. 재사용 컴포넌트 패턴

### 6.1 KPI 카드 (스파크라인 포함)
```js
function renderKPIs(){
  kpiGrid.innerHTML = '';
  DATA.kpi.forEach(k=>{
    const up = k.chg >= 0;
    const good = k.invert ? !up : up;             // 색 의미: 좋음/나쁨
    const cls  = good ? 'down' : 'up';            // down=초록, up=빨강
    const el = document.createElement('div'); el.className='kpi';
    el.innerHTML = `
      <div class="label">${k.label}<span class="en">${k.en}</span></div>
      <div class="val">${k.val} <span class="unit">${k.unit}</span></div>
      <div class="chg ${cls}">${up?'▲':'▼'} ${Math.abs(k.chg)}</div>
      <canvas class="spark" id="spark-${k.id}"></canvas>
      <div class="src">출처 · ${k.src}</div>`;
    kpiGrid.appendChild(el);
  });
}
```

### 6.2 히트맵 매트릭스 — 점수→색
```js
function scoreColor(s){
  if (s>=70) return cssVar('--down');   // 양호(초록)
  if (s>=50) return cssVar('--warn');   // 중립(노랑)
  return cssVar('--up');                // 주의(빨강)
}
// 셀: <div class="cell" style="background:${scoreColor(c.s)}">${c.d}</div>
```

### 6.3 신호등 카드 / 흐름 바
- 신호등: `🟢/🟡/🔴` + 판정문구, 데이터(`DATA.signals`)로 렌더
- 흐름 바: `width:${v}%` 의 `.track > div` 진행바, 색은 변수 참조

---

## 7. 차트 패턴 (Chart.js v4)

색을 CSS 변수에서 읽는 **공용 옵션 빌더**로 통일 → 테마 전환에 자동 대응.

```js
let charts = {};
function baseLineOpts(){
  return {
    responsive:true, maintainAspectRatio:false,
    interaction:{ mode:'index', intersect:false },
    plugins:{
      legend:{ position:'bottom', labels:{ color:cssVar('--text-dim'), usePointStyle:true } },
      tooltip:{ backgroundColor:cssVar('--panel-2'), borderColor:cssVar('--border'), borderWidth:1 }
    },
    scales:{ x:{grid:{color:cssVar('--border')},ticks:{color:cssVar('--text-dim')}},
             y:{grid:{color:cssVar('--border')},ticks:{color:cssVar('--text-dim')}} }
  };
}
function baseBarOpts(suffix){ const o=baseLineOpts(); o.plugins.legend.display=false;
  o.scales.y.ticks.callback=v=>v+(suffix||''); return o; }

// 반원 게이지 = doughnut + circumference:180, rotation:270, cutout:'72%'
// 스파크라인 = line, 축/범례/툴팁 모두 끄고 pointRadius:0, tension:.4

function rebuildAllCharts(){
  Object.values(charts).forEach(c=>{ try{c.destroy();}catch(e){} });  // 테마전환 시 파괴 후 재생성
  charts = {};
  buildSparks(); buildIndexChart(); buildFxChart();
  buildBarChart('cpiChart', DATA.cpi, '%'); /* ... */ buildVixGauge();
}
```

> **핵심:** 테마 토글 시 차트를 **destroy → 재생성**해야 새 변수색이 반영된다.

---

## 8. 인터랙션

| 기능 | 구현 |
|---|---|
| 테마 토글 | CSS 변수 + `localStorage` + 차트 재생성 |
| 필터 탭 | `activeRegion` 상태 → 카드/셀 디밍(opacity), 차트 데이터셋 강조(`borderWidth`/색) 후 `chart.update()` |
| 차트 호버 | Chart.js `interaction:{mode:'index'}` 툴팁 |
| 범례 토글 | Chart.js 기본 legend 클릭 |

필터의 라인차트 강조는 시리즈를 국가코드로 식별(라벨에 `flag` 포함 → `ds.label.includes(REGIONS[k].flag)`).

---

## 9. 이미지 렌더링 (목업/리포트/공유)

`scripts/render.mjs` — Playwright 헤드리스 Chromium으로 full-page PNG(다크/라이트) 산출.
콘솔 에러를 수집해 0이 아니면 실패 처리. Playwright는 전역 설치본도 견고하게 resolve.

```bash
playwright install chromium      # 컨테이너당 1회
node scripts/render.mjs          # → mockup-dark.png / mockup-light.png
```

렌더 시 테마 전환: `page.evaluate(t => { document.documentElement.setAttribute('data-theme',t); window.rebuildAllCharts(); }, theme)` 후 스크린샷.

---

## 10. 새 프로젝트로 이식하는 순서

1. `index.html` + `assets/chart.umd.min.js` + `scripts/render.mjs` 복사
2. `:root` 색 변수로 **리브랜딩**(accent·시리즈색)
3. 도메인에 맞게 **`DATA` 객체 교체** — kpi/matrix/series/단일값맵/signals/flow
4. 섹션 제목·라벨·`REGIONS`(또는 분류 키) 수정
5. 필요 차트만 남기고 `rebuildAllCharts()`에서 빌더 추가/삭제
6. `node scripts/render.mjs`로 렌더 확인(콘솔 에러 0)
7. (선택) 실데이터 연동 — `DATA`를 `fetch` 결과로 채우는 매핑 함수만 추가

> 뷰 로직은 그대로 두고 `DATA`만 바꾸는 것이 이식의 핵심이다.
> 데이터 출처·갱신 절차는 `REFRESH.md` 참고.
