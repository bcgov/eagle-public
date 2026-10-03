/**
 * Prints every CSS rule that matches an element and sets a property, in cascade order, so a lost
 * specificity fight is visible. Uses CDP, so it sees shorthands and the browser's own ordering.
 *
 *   node tools/rules.mjs <url> <selector> <css-property>
 *
 * Basic auth is supplied automatically for the test host, and the gate flag is seeded.
 */
import { chromium } from '@playwright/test';
const [url, sel, prop] = process.argv.slice(2);
const auth = url.includes('test.projects') ? { username: process.env.BASIC_AUTH_USER ?? '', password: process.env.BASIC_AUTH_PASS ?? '' } : undefined;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 800 }, httpCredentials: auth });
await c.addInitScript(() => { try { localStorage.setItem('eagle-gate','1'); } catch { /* private mode */ } });
const p = await c.newPage();
await p.goto(url, { waitUntil: 'commit' });
await p.waitForLoadState('networkidle').catch(() => {
  // networkidle never settles on a page that keeps polling
});
await p.waitForTimeout(3000);
const cdp = await p.context().newCDPSession(p);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
if (!nodeId) { console.log('NOT FOUND'); } else {
  const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
  for (const r of m.matchedCSSRules || []) {
    const d = r.rule.style.cssProperties.filter(x => x.name === prop || x.name.startsWith(prop + '-'));
    if (d.length) console.log(`${r.rule.selectorList.text}  =>  ${d.map(x=>x.name+': '+x.value).join('; ')}   [${r.rule.origin}]`);
  }
}
await b.close();
