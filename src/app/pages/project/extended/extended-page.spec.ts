import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig, type EnvConfig } from 'app/config/config';
import { contentTabFor, extendedPageFor, extendedSteps } from './extended-page';
import type { ExtendedPage, ExtendedTimeline } from './types';

describe('contentTabFor', () => {
  const prose = [{ type: 'prose' as const, id: 'p', text: 'Text.' }];
  const page: ExtendedPage = {
    version: 1,
    tabs: [
      { segment: 'overview', main: prose },
      { segment: 'updates', main: prose },
      { segment: 'documents', replace: true, main: prose },
      { segment: 'extra', main: prose },
    ],
  };

  it('takes a standard tab over only with replace, as the validator requires', () => {
    expect(contentTabFor(page, 'overview')).toBeNull();
    expect(contentTabFor(page, 'updates')).toBeNull();
    expect(contentTabFor(page, 'documents')?.segment).toBe('documents');
  });

  it('draws a custom tab from its blocks', () => {
    expect(contentTabFor(page, 'extra')?.segment).toBe('extra');
  });
});

const originalEnv = window.__env;

/** Loads the runtime config with `EXTENDED_PROJECT_PAGES` set to whatever a config document held. */
async function configure(projects: unknown): Promise<void> {
  window.__env = { EXTENDED_PROJECT_PAGES: projects } as unknown as EnvConfig;
  await loadConfig();
}

afterEach(async () => {
  window.__env = originalEnv;
  await loadConfig();
});

describe('extendedPageFor', () => {
  it('is off when the config has no EXTENDED_PROJECT_PAGES', async () => {
    window.__env = {} as EnvConfig;
    await loadConfig();

    expect(extendedPageFor('proj-1')).toBeNull();
  });

  it('is off for every project when the map is empty, as env.js ships it', async () => {
    await configure({});

    expect(extendedPageFor('proj-1')).toBeNull();
  });

  it('returns the Pacific Link content for the id the config maps to it', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    expect(extendedPageFor('proj-1')?.displayName).toBe('Pacific Link');
  });

  it('leaves a project the map does not name alone', async () => {
    await configure({ 'proj-1': 'pacific-link' });

    expect(extendedPageFor('proj-2')).toBeNull();
  });

  it('is off for an empty project id', async () => {
    await configure({ '': 'pacific-link' });

    expect(extendedPageFor('')).toBeNull();
  });

  it.each<[string, unknown]>([
    ['a bare string', 'pacific-link'],
    ['a number', 42],
    ['null', null],
    ['an array of keys', ['pacific-link']],
    ['an array of pairs', [['proj-1', 'pacific-link']]],
    ['an unknown content key', { 'proj-1': 'pacific-lnk' }],
    ['a key differing only in case', { 'proj-1': 'Pacific-Link' }],
    ['a content key that is an Object prototype member', { 'proj-1': 'constructor' }],
    ['a non-string value', { 'proj-1': { key: 'pacific-link' } }],
    ['an empty key', { 'proj-1': '' }],
  ])('is off when the config holds %s', async (_label, projects) => {
    await configure(projects);

    expect(extendedPageFor('proj-1')).toBeNull();
  });

  it('is off for a project id that names an Object prototype member', async () => {
    await configure({});

    expect(extendedPageFor('constructor')).toBeNull();
  });
});

describe('extendedSteps', () => {
  const STEPS = ['One', 'Two', 'Three'].map((name) => ({ name, dateLabel: '', detail: '' }));

  function timeline(currentStep: number): ExtendedTimeline {
    return {
      title: '',
      note: '',
      steps: STEPS,
      currentStep,
      stateLabels: { complete: '', current: '', upcoming: '' },
    };
  }

  it('marks steps before the current one complete and those after it upcoming', () => {
    expect(extendedSteps(timeline(1)).map((step) => step.state)).toEqual([
      'complete',
      'current',
      'upcoming',
    ]);
  });

  it('marks every step complete once the current step is past the last', () => {
    expect(extendedSteps(timeline(3)).map((step) => step.state)).toEqual([
      'complete',
      'complete',
      'complete',
    ]);
  });
});
