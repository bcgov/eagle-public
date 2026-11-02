import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* The deploy workflows sed src/env.js and `grep -qF` the result, so a key dropped from env.js fails
   the deploy, not the app. These hold env.js and both workflows to one list, failing here first. */
describe('deploy workflow env.js guards', () => {
  // Vitest runs with the project root as cwd; `import.meta.url` here is a module-graph URL, not a file.
  const root = process.cwd();
  const envJs = readFileSync(resolve(root, 'src/env.js'), 'utf-8');

  /** `sed -i "s|window.__env.KEY = .*|window.__env.KEY = value;|" src/env.js` */
  function seds(workflow: string): { key: string; replacement: string }[] {
    return [
      ...workflow.matchAll(/sed -i "s\|window\.__env\.(\w+) = \.\*\|([^|]+)\|" src\/env\.js/g),
    ].map((m) => ({ key: m[1], replacement: m[2] }));
  }

  /** The quoted `window.__env...` lines inside a `for expected/relative in ...` loop. */
  function guards(workflow: string, loopVar: string): string[] {
    const body = workflow.split(`for ${loopVar} in `)[1];
    expect(body, `no "for ${loopVar} in" loop found`).toBeDefined();
    return [...body.split('; do')[0].matchAll(/"(window\.__env\.[^"]+)"/g)].map((m) => m[1]);
  }

  /** What the workflow hands to the build: committed env.js with its own sed lines applied. */
  function rewritten(workflow: string): string {
    return seds(workflow).reduce(
      (js, { key, replacement }) =>
        js.replace(new RegExp(`window\\.__env\\.${key} = .*`), replacement),
      envJs,
    );
  }

  for (const name of ['deploy-azure-staging', 'deploy-azure-prod']) {
    describe(name, () => {
      const workflow = readFileSync(resolve(root, `.github/workflows/${name}.yaml`), 'utf-8');

      it('rewrites a key that env.js actually holds', () => {
        const missing = seds(workflow)
          .map((s) => s.key)
          .filter((key) => !new RegExp(`window\\.__env\\.${key} = `).test(envJs));
        expect(missing).toEqual([]);
      });

      it('finds every line its post-rewrite guard loop greps for', () => {
        const js = rewritten(workflow);
        const expected = guards(workflow, 'expected');
        expect(expected.length).toBeGreaterThan(0);
        expect(expected.filter((line) => !js.includes(line))).toEqual([]);
      });

      it('finds every same-origin default its relative-path guard loop greps for', () => {
        const js = rewritten(workflow);
        const relative = guards(workflow, 'relative');
        expect(relative.length).toBeGreaterThan(0);
        expect(relative.filter((line) => !js.includes(line))).toEqual([]);
      });

      it('no longer names the retired penguin ingest key', () => {
        expect(workflow).not.toMatch(/ANALYTICS_API_URL/);
      });

      // Only the Vite server proxies /notify-api; no deployed origin has that route.
      it('ships no dev-server notify path', () => {
        expect(rewritten(workflow)).not.toContain("'/notify-api'");
      });
    });
  }

  it('ships production with NOTIFY_API empty, so the subscribe control stays hidden', () => {
    const workflow = readFileSync(
      resolve(root, '.github/workflows/deploy-azure-prod.yaml'),
      'utf-8',
    );
    expect(rewritten(workflow)).toContain("window.__env.NOTIFY_API = '';");
  });
});
