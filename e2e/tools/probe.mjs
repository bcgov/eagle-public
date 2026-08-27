/**
 * Prints computed styles and box size for the first few matches of a selector on one page.
 *
 *   node tools/probe.mjs <url> <selector> [css-property ...]
 *
 * Basic auth is supplied automatically for the test host, and the gate flag is seeded.
 */
import { chromium } from '@playwright/test';
const [url, sel, ...props] = process.argv.slice(2);
const auth = url.includes('test.projects') ? { username: process.env.BASIC_AUTH_USER ?? '', password: process.env.BASIC_AUTH_PASS ?? '' } : undefined;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 800 }, httpCredentials: auth });
await c.addInitScript(() => { try { sessionStorage.setItem('eagle-gate','1'); } catch {} });
const p = await c.newPage();
await p.goto(url, { waitUntil: 'commit' });
await p.waitForLoadState('networkidle').catch(()=>{});
await p.waitForTimeout(3000);
const out = await p.evaluate(([sel, props]) => {
  return [...document.querySelectorAll(sel)].slice(0, 4).map(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const o = { tag: el.tagName.toLowerCase(), cls: el.className, w: Math.round(r.width), h: Math.round(r.height) };
    for (const k of props) o[k] = cs.getPropertyValue(k);
    return o;
  });
}, [sel, props]);
console.log(JSON.stringify(out, null, 1));
await b.close();
