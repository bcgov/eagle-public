import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * The deploy workflows sed-rewrite src/env.js and then `grep -qF` for the results, exiting 1 when a
 * line is missing. Deleting a key here therefore breaks test and prod deploys before the build
 * runs, and nothing in the app fails first — removing the retired ANALYTICS_* keys did exactly that.
 * These specs hold env.js and both workflows to the same list so the next removal fails here.
 */
describe('deploy workflow env.js guards', () => {
  const root = resolve(__dirname, '..');
  const envJs = readFileSync(resolve(root, 'src/env.js'), 'utf-8');

  /** `sed -i "s|window.__env.KEY = .*|window.__env.KEY = value;|" src/env.js` */
  function seds(workflow: string): { key: string; replacement: string }[] {
    return [...workflow.matchAll(/sed -i "s\|window\.__env\.(\w+) = \.\*\|([^|]+)\|" src\/env\.js/g)]
      .map(m => ({ key: m[1], replacement: m[2] }));
  }

  /** The quoted `window.__env...` lines inside a `for expected/relative in ...` loop. */
  function guards(workflow: string, loopVar: string): string[] {
    const body = workflow.split(`for ${loopVar} in `)[1];
    expect(body, `no "for ${loopVar} in" loop found`).toBeDefined();
    return [...body.split('; do')[0].matchAll(/"(window\.__env\.[^"]+)"/g)].map(m => m[1]);
  }

  /** What the workflow hands to the build: committed env.js with its own sed lines applied. */
  function rewritten(workflow: string): string {
    return seds(workflow).reduce(
      (js, { key, replacement }) =>
        js.replace(new RegExp(`window\\.__env\\.${key} = .*`), replacement),
      envJs
    );
  }

  for (const name of ['deploy-azure-staging', 'deploy-azure-prod']) {
    describe(name, () => {
      const workflow = readFileSync(resolve(root, `.github/workflows/${name}.yaml`), 'utf-8');

      it('rewrites a key that env.js actually holds', () => {
        const missing = seds(workflow)
          .map(s => s.key)
          .filter(key => !new RegExp(`window\\.__env\\.${key} = `).test(envJs));
        expect(missing).toEqual([]);
      });

      it('finds every line its post-rewrite guard loop greps for', () => {
        const js = rewritten(workflow);
        const expected = guards(workflow, 'expected');
        expect(expected.length).toBeGreaterThan(0);
        expect(expected.filter(line => !js.includes(line))).toEqual([]);
      });

      it('finds every same-origin default its relative-path guard loop greps for', () => {
        const js = rewritten(workflow);
        const relative = guards(workflow, 'relative');
        expect(relative.length).toBeGreaterThan(0);
        expect(relative.filter(line => !js.includes(line))).toEqual([]);
      });

      it('no longer touches the retired penguin-analytics keys', () => {
        expect(workflow).not.toMatch(/ANALYTICS/);
      });
    });
  }
});
