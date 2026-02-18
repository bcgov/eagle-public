/**
 * Penguin Analytics Plugin - Anonymous tracking for eagle-public (no PII).
 * Auto-tracks: page views, link clicks, button clicks, user activity.
 */
import type { AnalyticsPlugin, AnalyticsInstance } from 'analytics';

export interface PenguinAnalyticsConfig {
  apiUrl: string;
  sourceApp: string;
  debug?: boolean;
  enhancedTracking?: boolean;  // Include browser context (timezone, screen size, viewport)
}

interface EventPayload {
  timestamp: string;
  eventType: string;
  sessionId: string;
  sourceApp: string;
  properties?: Record<string, unknown>;
}

const getSessionId = (): string => {
  const key = 'penguin_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
};

const getBrowserContext = (config: PenguinAnalyticsConfig): Record<string, unknown> => {
  const basicContext = {
    url: window.location.pathname,  // Path only (privacy-friendly)
    title: document.title
  };

  // Enhanced tracking includes browser fingerprinting data
  if (config.enhancedTracking) {
    // Get connection info (Network Information API)
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    // Get browser info from User-Agent Client Hints API (with fallback)
    const uaData = navigator.userAgentData;
    const primaryBrand = uaData?.brands?.find(b => !b.brand.includes('Not'))
      || uaData?.brands?.[0];

    return {
      ...basicContext,
      url: window.location.href,  // Full URL (may include query params)
      referrer: document.referrer,

      // Screen & viewport
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      pixel_ratio: window.devicePixelRatio,
      color_depth: window.screen.colorDepth,

      // Locale & timezone
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      languages: navigator.languages?.slice(0, 3).join(','),

      // Device & browser detection
      user_agent: navigator.userAgent,
      platform: uaData?.platform || navigator.platform,
      browser: primaryBrand?.brand,
      browser_version: primaryBrand?.version,
      mobile: uaData?.mobile ?? (navigator.maxTouchPoints > 0),
      touch_points: navigator.maxTouchPoints,

      // Network info (may not be available in all browsers)
      connection_type: connection?.effectiveType,
      connection_downlink: connection?.downlink,
      connection_rtt: connection?.rtt
    };
  }

  return basicContext;
};

const sendEvent = (config: PenguinAnalyticsConfig, eventData: Partial<EventPayload>): void => {
  if (!config.apiUrl) return;

  const payload: EventPayload = {
    timestamp: new Date().toISOString(),
    sourceApp: config.sourceApp,
    sessionId: getSessionId(),
    eventType: (eventData.eventType || 'unknown').trim().substring(0, 100),
    ...eventData
  };

  // Remove undefined properties
  if (payload.properties) {
    payload.properties = Object.fromEntries(
      Object.entries(payload.properties).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(payload.properties).length === 0) delete payload.properties;
  }

  if (config.debug) console.log('[Analytics]', payload);

  fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(err => config.debug && console.warn('[Analytics] Failed:', err));
};

export function penguinAnalyticsPlugin(pluginConfig: PenguinAnalyticsConfig): AnalyticsPlugin {
  let config = pluginConfig;
  let isActive = false;
  let sessionStart = '';
  let activityInterval: ReturnType<typeof setInterval> | null = null;
  let lastActivity = Date.now();

  const trackActivity = () => { lastActivity = Date.now(); };

  const deferSend = (fn: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(fn);
    } else {
      setTimeout(fn, 0);
    }
  };

  const handleClick = (event: MouseEvent) => {
    if (!isActive) return;
    const target = event.target as HTMLElement;

    // Link clicks
    const link = target.closest('a');
    if (link?.href) {
      const href = link.getAttribute('href') || '';
      deferSend(() => sendEvent(config, {
        eventType: 'Link Clicked',
        properties: {
          link_url: href,
          link_text: link.textContent?.trim().substring(0, 100) || '',
          link_type: href.startsWith('http') || href.startsWith('//') ? 'external' : 'internal',
          path: window.location.pathname
        }
      }));
      return;
    }

    // Button clicks
    const btn = target.closest('button, [role="button"], input[type="submit"]') as HTMLElement;
    if (btn) {
      deferSend(() => sendEvent(config, {
        eventType: 'Button Clicked',
        properties: {
          button_text: btn.textContent?.trim().substring(0, 100) || btn.getAttribute('aria-label') || 'unknown',
          button_type: btn.getAttribute('type') || 'button',
          path: window.location.pathname
        }
      }));
    }
  };

  return {
    name: 'penguin-analytics',
    config: pluginConfig,

    initialize: ({ config: cfg }: { config: PenguinAnalyticsConfig; instance: AnalyticsInstance }) => {
      config = cfg;
      document.addEventListener('click', handleClick, { passive: true });
      if (config.debug) console.log('[Analytics] Initialized (anonymous mode)');
    },

    startTracking: () => {
      if (isActive || !config?.apiUrl) return;
      isActive = true;
      sessionStart = new Date().toISOString();

      // Activity tracking
      ['mousemove', 'keydown', 'scroll', 'click'].forEach(e =>
        document.addEventListener(e, trackActivity, { passive: true })
      );
      activityInterval = setInterval(() => {
        if (!isActive) return;
        sendEvent(config, {
          eventType: 'User Active',
          properties: {
            url: window.location.href,
            is_active: Date.now() - lastActivity < 60000,
            seconds_since_activity: Math.floor((Date.now() - lastActivity) / 1000)
          }
        });
      }, 30000);

      sendEvent(config, {
        eventType: 'Session Started',
        properties: { session_start: sessionStart, session_id: getSessionId(), ...getBrowserContext(config) }
      });

      if (config.debug) console.log('[Analytics] Session started:', getSessionId());
    },

    page: ({ payload }: { payload: Record<string, unknown> }) => {
      if (!isActive) return;
      const props = payload['properties'] as Record<string, unknown> | undefined;
      sendEvent(config, {
        eventType: 'Page Viewed',
        properties: { page_name: props?.['name'] || 'unknown', ...getBrowserContext(config), ...props }
      });
    },

    track: ({ payload }: { payload: Record<string, unknown> }) => {
      if (!isActive) return;
      sendEvent(config, {
        eventType: payload['event'] as string,
        properties: payload['properties'] as Record<string, unknown>
      });
    },

    identify: () => { /* No-op: no PII collection in eagle-public */ },

    loaded: () => true,

    reset: () => {
      if (isActive) {
        sendEvent(config, {
          eventType: 'Session Ended',
          properties: { session_end: new Date().toISOString(), session_start: sessionStart, session_id: getSessionId() }
        });
      }
      isActive = false;
      if (activityInterval) clearInterval(activityInterval);
      activityInterval = null;
      ['mousemove', 'keydown', 'scroll', 'click'].forEach(e =>
        document.removeEventListener(e, trackActivity)
      );
    }
  };
}

export default penguinAnalyticsPlugin;
