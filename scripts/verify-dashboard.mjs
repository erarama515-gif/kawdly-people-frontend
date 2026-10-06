// Automated visual verification of the KAWDLY PEOPLE dashboard.
// Drives the real dev server with Playwright (Chromium) and saves video +
// screenshots as proof files under test-evidence/.
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const EVIDENCE = path.join(ROOT, 'test-evidence');
const VIDEOS = path.join(EVIDENCE, 'videos');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

fs.mkdirSync(VIDEOS, { recursive: true });

// Resolve the employees route from the nav config (don't hardcode it).
const navigationSrc = fs.readFileSync(path.join(ROOT, 'src/config/navigation.ts'), 'utf8');
const navPairs = [...navigationSrc.matchAll(/\{ id: '([A-Za-z0-9_-]+)', path: '([^']+)', icon: \w+ \}/g)];
const employeesEntry = navPairs.find(([, id]) => id === 'employees');
if (!employeesEntry) throw new Error('No "employees" entry found in src/config/navigation.ts');
const EMPLOYEES_PATH = employeesEntry[2];

const QUEUE_TYPES = ['leave', 'payroll', 'contracts'];

/** Read the current numeric aria-label of the row's RollingNumber, before a click. */
async function readRowCount(page, type) {
  const el = page
    .getByTestId(`decision-action-${type}`)
    .locator('xpath=..')
    .locator('span[aria-label][class*="text-[22px]"]');
  await el.waitFor({ state: 'attached' });
  return el.getAttribute('aria-label');
}

/** Click a row's action button repeatedly until it collapses away. */
async function resolveRow(page, type) {
  console.log(`--- Resolving row "${type}" ---`);
  for (let i = 0; i < 20; i++) {
    const button = page.getByTestId(`decision-action-${type}`);
    const visible = await button.isVisible().catch(() => false);
    if (!visible) {
      console.log(`  button hidden/detached after ${i} click(s)`);
      return;
    }
    const raw = await readRowCount(page, type);
    const n = Number((raw || '').replace(/\D/g, ''));
    console.log(`  click #${i + 1}: row count before click = "${raw}"`);
    await button.click();
    if (!Number.isFinite(n) || n <= 1) {
      // Last remaining item — wait for the collapse animation to finish.
      await button.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
      console.log(`  row resolved and collapsed (was ${raw})`);
      return;
    }
    await page.waitForTimeout(80);
  }
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE_URL, { method: 'GET' });
      if (res.ok) return;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Dev server not reachable at ${BASE_URL}`);
}

const savedFiles = [];
function collectFiles(dir, base) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, base);
    else savedFiles.push(full);
  }
}

const browser = await chromium.launch();

// ---------------------------------------------------------------- Test A ---
console.log('\n=== TEST A: resolve sequence (video) ===');
const contextA = await browser.newContext({
  recordVideo: { dir: VIDEOS, size: { width: 1440, height: 900 } },
});
const pageA = await contextA.newPage();
await pageA.goto(BASE_URL);
await expect(pageA.getByTestId('decision-action-leave')).toBeVisible({ timeout: 15000 });

for (const type of QUEUE_TYPES) {
  await resolveRow(pageA, type);
}

console.log('Asserting empty state becomes visible...');
await expect(pageA.getByTestId('decision-empty-state')).toBeVisible({ timeout: 5000 });
const emptyShot = path.join(EVIDENCE, 'decisions-empty-state.png');
await pageA.screenshot({ path: emptyShot, fullPage: true });
console.log(`Empty state visible. Screenshot: ${emptyShot}`);
await pageA.waitForTimeout(1600);
const emptyShotAfterWait = path.join(EVIDENCE, 'decisions-empty-state-after-wait.png');
await pageA.screenshot({ path: emptyShotAfterWait, fullPage: false });
console.log(`After-wait screenshot: ${emptyShotAfterWait}`);
await contextA.close(); // finalizes the webm
await pageA.close();

// ---------------------------------------------------------------- Test B ---
console.log('\n=== TEST B: 768px layout (overflow + 2x2 kpi grid) ===');
const contextB = await browser.newContext({ viewport: { width: 768, height: 1024 } });
const pageB = await contextB.newPage();
await pageB.goto(BASE_URL);
await expect(pageB.getByTestId('kpi-grid')).toBeVisible({ timeout: 15000 });

const overflow = await pageB.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  bodyScrollWidth: document.body.scrollWidth,
}));
console.log(
  `[B] scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} ` +
    `(diff ${overflow.scrollWidth - overflow.clientWidth}px)`,
);
// allow 1px tolerance for scrollbar rounding
console.log(`[B] no-horizontal-overflow: ${overflow.scrollWidth - overflow.clientWidth <= 1 ? 'PASS' : 'FAIL'}`);

const tileTops = await pageB.evaluate(() => {
  const grid = document.querySelector('[data-testid="kpi-grid"]');
  const tiles = [...grid.children];
  return { tops: tiles.map((t, i) => ({ i: i + 1, top: t.offsetTop, left: t.offsetLeft })), count: tiles.length };
});
console.log(
  `[B] kpi-grid tile offsetTops: ${tileTops.tops.map((t) => `tile${t.i}=${t.top}`).join(', ')} ` +
    `(count=${tileTops.count})`,
);
const t1 = tileTops.tops[0]?.top;
const t3 = tileTops.tops[2]?.top;
console.log(`[B] wrapped-to-2-columns: ${tileTops.count === 4 && t1 !== undefined && t3 !== undefined && t1 !== t3 ? 'PASS' : 'FAIL'} (tile1=${t1}, tile3=${t3})`);

const mobileShot = path.join(EVIDENCE, 'mobile-768.png');
await pageB.screenshot({ path: mobileShot, fullPage: true });
console.log(`Screenshot: ${mobileShot}`);
await contextB.close();
await pageB.close();

// ---------------------------------------------------------------- Test C ---
console.log('\n=== TEST C: employees KPI navigation ===');
const contextC = await browser.newContext();
const pageC = await contextC.newPage();
await pageC.goto(BASE_URL);
await expect(pageC.getByTestId('kpi-link-employees')).toBeVisible({ timeout: 15000 });
await pageC.getByTestId('kpi-link-employees').click();
await pageC.waitForURL(new RegExp(`${EMPLOYEES_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), { timeout: 15000 });
const finalUrl = pageC.url();
console.log(`[C] navigated to: ${finalUrl}`);
console.log(`[C] matches nav config route: ${finalUrl.endsWith(EMPLOYEES_PATH) ? 'PASS' : 'FAIL'} (expected ${EMPLOYEES_PATH})`);
const navShot = path.join(EVIDENCE, 'employees-navigation.png');
await pageC.screenshot({ path: navShot });
console.log(`Screenshot: ${navShot}`);
await contextC.close();
await pageC.close();

await browser.close();

// ----------------------------------------------------------------- summary ---
collectFiles(EVIDENCE);
console.log('\n=== EVIDENCE FILES ===');
for (const file of savedFiles) console.log(file);