// Programmatic visual audit of the running app.
// This model cannot decode screenshots, so UI problems are found by inspecting
// computed layout/geometry instead: x-overflow, text clipping, broken images,
// missing fonts, contrast ratios. Saves screenshots for human review.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const SHOTS = path.join(ROOT, 'test-evidence', 'visual-audit');
fs.mkdirSync(SHOTS, { recursive: true });
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function auditInPage() {
  // Wait for webfonts to resolve before checking font-family availability.
  await document.fonts.ready;
  const results = { overflowEls: [], clipped: [], brokenImages: [], contrast: [], monoOk: [], fontsChecked: [], arabicStatus: [] };
  const vw = window.innerWidth;

  // 1) X-overflow: any painted element sticking outside the viewport.
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.left < -1 || r.right > vw + 1) {
      results.overflowEls.push({
        tag: el.tagName,
        cls: (el.className && String(el.className).slice(0, 90)) || '',
        text: (el.textContent || '').trim().slice(0, 40),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
      });
    }
  }
  results.docOverflowX = document.documentElement.scrollWidth - vw;

  // 2) Text clipping: box smaller than its content with no deliberate ellipsis.
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const intentional = cs.textOverflow === 'ellipsis' && cs.whiteSpace.includes('nowrap') && cs.overflowX !== 'visible';
    if (!intentional && el.scrollWidth - el.clientWidth > 2) {
      const r = el.getBoundingClientRect();
      results.clipped.push({
        cls: (el.className && String(el.className).slice(0, 80)) || el.tagName,
        text: t.slice(0, 40),
        scroll: el.scrollWidth, box: el.clientWidth,
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
  }

  // 3) Broken / failed images.
  for (const img of document.querySelectorAll('img')) {
    const nn = img.naturalWidth || 0;
    if (nn === 0) results.brokenImages.push({ src: img.getAttribute('src'), cls: (img.className || '').slice(0, 60) });
    else results.brokenImages.push({ src: img.getAttribute('src'), ok: true });
  }

  // 4) Font availability (after fonts.ready so webfonts have resolved).
  results.fontsChecked = ['IBM Plex Sans', 'IBM Plex Sans Arabic', 'JetBrains Mono'].map((name) => ({
    name,
    ok: document.fonts.check('16px "' + name + '"', name === 'IBM Plex Sans Arabic' ? '\u0645\u0631\u062d\u0628\u0627' : ''),
  }));
  results.arabicStatus = [...document.fonts]
    .filter((f) => /Arabic/i.test(String(f.family)))
    .map((f) => f.status);
  results.bodyFont = getComputedStyle(document.body).fontFamily.split(',')[0];

  // 5) Contrast audit for visible text nodes.
  function parseCssColor(c) {
    const m = String(c).match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s]+([\d.]+))?\)/);
    if (!m) return null;
    return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  }
  function luminance(rgb) {
    const f = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function ratio(a, b) {
    const L1 = luminance(a), L2 = luminance(b);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function effectiveBg(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const c = parseCssColor(cs.backgroundColor);
      if (c && c[3] > 0) {
        if (c[3] < 1) {
          const below = effectiveBg(node.parentElement);
          return [c[0] * c[3] + below[0] * (1 - c[3]), c[1] * c[3] + below[1] * (1 - c[3]), c[2] * c[3] + below[2] * (1 - c[3])];
        }
        return [c[0], c[1], c[2]];
      }
      node = node.parentElement;
    }
    return [244, 245, 247];
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = (node.textContent || '').trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const size = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 600;
    const colorRaw = parseCssColor(cs.color);
    if (!colorRaw) continue;
    const bg = effectiveBg(el);
    const fg = colorRaw[3] >= 1 ? [colorRaw[0], colorRaw[1], colorRaw[2]] : (function blend() {
      const a = colorRaw[3];
      return [colorRaw[0] * a + bg[0] * (1 - a), colorRaw[1] * a + bg[1] * (1 - a), colorRaw[2] * a + bg[2] * (1 - a)];
    })();
    const r = ratio(fg, bg);
    const needs = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (r < needs) {
      const key = fg.map(Math.round).join(',') + '|' + bg.map(Math.round).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        const isCoral = bg[0] > 200 && bg[1] < 140 && bg[2] < 120;
        const isNavy = bg[2] > bg[0] && bg[0] < 60 && bg[2] > 90;
        results.contrast.push({
          text: text.slice(0, 28),
          cls: (el.className && String(el.className).slice(0, 60)) || el.tagName,
          ratio: r.toFixed(2), size, bold,
          fg: fg.map(Math.round).join(','),
          bg: bg.map(Math.round).join(','),
          note: isCoral ? 'coral-pair' : (isNavy ? 'on-navy' : 'other'),
        });
      }
    }
  }
  results.contrast.sort((a, b) => a.ratio - b.ratio);

  // 6) Every data numeral uses mono.
  document.querySelectorAll('.nums').forEach((el) => {
    const fam = getComputedStyle(el).fontFamily;
    if (fam && !/JetBrains Mono/i.test(fam)) results.monoOk.push({ text: (el.textContent || '').trim().slice(0, 20), fam });
  });
  return results;
}

async function audit(browser, label, viewport, language) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (language === 'ar') {
    await context.addInitScript((lang) => {
      try { localStorage.setItem('kawdly-people-language', lang); } catch {}
    }, 'ar');
  }
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const data = await page.evaluate(auditInPage);
  const shot = path.join(SHOTS, `${label}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  console.log(`\n===== ${label} @ ${viewport.width}x${viewport.height} (${language}) =====`);
  console.log(`doc overflow-x px: ${data.docOverflowX}`);
  if (pageErrors.length) console.log('PAGE ERRORS:', pageErrors.join(' | '));

  const overflow = data.overflowEls.filter((e) => e.w > 0);
  if (overflow.length) {
    console.log(`X-OVERFLOW ${overflow.length}:`);
    for (const e of overflow.slice(0, 12)) console.log(`  [${e.tag}] left=${e.left} right=${e.right} w=${e.w} ${e.cls || e.text}`);
  } else console.log('X-OVERFLOW: none');

  const clipped = data.clipped.slice(0, 12);
  if (clipped.length) {
    console.log(`CLIPPED-TEXT ${data.clipped.length} (sample):`);
    for (const e of clipped) console.log(`  box=${e.box} content=${e.scroll} h=${e.h} "${e.text}" ${e.cls}`);
  } else console.log('CLIPPED-TEXT: none');

  const broken = data.brokenImages.filter((i) => !i.ok);
  console.log(`images: ${data.brokenImages.length} total, ${broken.length} broken`);
  for (const b of broken) console.log(`  BROKEN ${b.src}`);

  console.log('fonts:', data.fontsChecked.map((f) => `${f.name}=${f.ok ? 'OK' : 'MISSING'}`).join(' '), `| body->${data.bodyFont}`, data.arabicStatus.length ? `| arabic subset(s): [${data.arabicStatus.join(',')}]` : '| arabic subsets: none');
  console.log(`mono violations: ${data.monoOk.length}`);

  if (data.contrast.length) {
    console.log(`CONTRAST < AA (${data.contrast.length}) — worst 10:`);
    for (const c of data.contrast.slice(0, 10)) {
      console.log(`  ${c.ratio} [${c.size}px${c.bold ? ' bold' : ''}] "${c.text}" ${c.cls} fg=${c.fg} bg=${c.bg} note=${c.note}`);
    }
  } else console.log('CONTRAST: all pass');

  await context.close();
  return shot;
}

const browser = await chromium.launch();
const cases = [
  ['desktop', { width: 1440, height: 900 }, 'en'],
  ['desktop', { width: 1440, height: 900 }, 'ar'],
  ['small-desktop', { width: 1280, height: 800 }, 'en'],
  ['tablet', { width: 768, height: 1024 }, 'en'],
  ['mobile', { width: 390, height: 844 }, 'en'],
  ['narrow', { width: 320, height: 568 }, 'en'],
  ['mobile-ar', { width: 390, height: 844 }, 'ar'],
];
for (const [label, viewport, lang] of cases) await audit(browser, label, viewport, lang);
await browser.close();
console.log('\nScreenshots:', SHOTS);