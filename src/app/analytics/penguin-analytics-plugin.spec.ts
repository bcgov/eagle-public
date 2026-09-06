import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { penguinAnalyticsPlugin } from './penguin-analytics-plugin';

/**
 * Traffic classification is what the reports are cut by, and it is guesswork over strings: a
 * mislabelled channel is invisible until someone reads a quarter of numbers built on it.
 */
interface PluginConfig {
  apiUrl: string;
  sourceApp: string;
  debug?: boolean;
  enhancedTracking?: boolean;
}

interface Handlers {
  initialize: (args: { config: PluginConfig; instance: unknown }) => void;
  startTracking: () => void;
  page: (args: { payload: Record<string, unknown> }) => void;
  track: (args: { payload: Record<string, unknown> }) => void;
  reset: () => void;
}

const CONFIG: PluginConfig = { apiUrl: '/analytics', sourceApp: 'eagle-public' };
const ORIGINAL_SOURCE_KEY = '__user_original_source__';

let fetchMock: ReturnType<typeof vi.fn>;
let plugin: Handlers;

/** Nothing is sent before startTracking, so every test needs a live plugin. */
function activate(config: PluginConfig = CONFIG): Handlers {
  const handlers = penguinAnalyticsPlugin(config) as unknown as Handlers;
  handlers.initialize({ config, instance: null });
  handlers.startTracking();
  return handlers;
}

function sent(eventType: string): Record<string, unknown> | undefined {
  const bodies = fetchMock.mock.calls.map(
    ([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>,
  );
  return bodies.find((body) => body['eventType'] === eventType);
}

function channelFor(source: string, medium: string): unknown {
  localStorage.setItem(ORIGINAL_SOURCE_KEY, `source=${source}|medium=${medium}`);
  plugin = activate();
  plugin.page({ payload: { properties: { name: 'Home' } } });
  const properties = sent('Page Viewed')?.['properties'] as Record<string, unknown>;
  return properties['traffic_channel'];
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState({}, '', '/');
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  // Clears the 30s activity interval the plugin opened; without it the suite never settles.
  plugin?.reset();
  vi.unstubAllGlobals();
});

describe('traffic channel', () => {
  it.each([
    ['chatgpt.com', 'referral', 'chatbot'],
    ['claude.ai', 'referral', 'chatbot'],
    ['newsletter', 'email', 'email'],
    ['mailchimp', 'referral', 'email'],
    ['google', 'organic', 'search'],
    ['bing', 'organic', 'search'],
    ['acme', 'cpc', 'search'],
    ['facebook.com', 'referral', 'social'],
    ['anywhere', 'social', 'social'],
    ['(direct)', '(none)', 'direct'],
    ['localhost', 'referral', 'internal'],
    ['some-blog.example', 'referral', 'referral'],
  ])('classifies source=%s medium=%s as %s', (source, medium, expected) => {
    expect(channelFor(source, medium)).toBe(expected);
  });

  it('falls back to "other" when neither source nor medium says anything', () => {
    expect(channelFor('(direct)', 'unknown')).toBe('other');
  });
});

describe('traffic source', () => {
  it('reads the pipe-separated value the original-source plugin stores', () => {
    localStorage.setItem(
      ORIGINAL_SOURCE_KEY,
      'source=google|medium=cpc|campaign=spring%20sale|content=banner|term=ea%20projects',
    );
    plugin = activate();

    plugin.page({ payload: { properties: { name: 'Home' } } });

    expect(sent('Page Viewed')?.['properties']).toMatchObject({
      traffic_source: 'google',
      traffic_medium: 'cpc',
      traffic_campaign: 'spring sale',
      traffic_content: 'banner',
      traffic_term: 'ea projects',
    });
  });

  it('falls back to the URL utm parameters when nothing is stored', () => {
    history.replaceState({}, '', '/?utm_source=newsletter&utm_medium=email&utm_campaign=launch');
    plugin = activate();

    plugin.page({ payload: { properties: { name: 'Home' } } });

    expect(sent('Page Viewed')?.['properties']).toMatchObject({
      traffic_channel: 'email',
      traffic_source: 'newsletter',
      traffic_medium: 'email',
      traffic_campaign: 'launch',
    });
  });

  it('sends no traffic keys when there is no source at all', () => {
    plugin = activate();

    plugin.page({ payload: { properties: { name: 'Home' } } });

    expect(sent('Page Viewed')?.['properties']).not.toHaveProperty('traffic_channel');
  });
});

describe('the active switch', () => {
  it('sends nothing before startTracking', () => {
    const handlers = penguinAnalyticsPlugin(CONFIG) as unknown as Handlers;
    handlers.initialize({ config: CONFIG, instance: null });

    handlers.page({ payload: { properties: { name: 'Home' } } });
    handlers.track({ payload: { event: 'Document Downloaded' } });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a tracked event once active', () => {
    plugin = activate();

    plugin.track({ payload: { event: 'Document Downloaded', properties: { doc: 'abc' } } });

    expect(sent('Document Downloaded')?.['properties']).toEqual({ doc: 'abc' });
  });
});
