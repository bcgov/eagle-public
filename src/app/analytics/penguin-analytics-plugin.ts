/**
 * Penguin Analytics Plugin - Anonymous tracking for eagle-public (no PII).
 * Auto-tracks: page views, link clicks, button clicks, user activity.
 */
import type { AnalyticsPlugin, AnalyticsInstance } from 'analytics';
import { randomId } from 'app/utils/random-id';

interface PenguinAnalyticsConfig {
  apiUrl: string;
  sourceApp: string;
  debug?: boolean;
  enhancedTracking?: boolean; // Include browser context (timezone, screen size, viewport)
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
    id = randomId();
    sessionStorage.setItem(key, id);
  }
  return id;
};

/**
 * Get traffic source data from URL parameters (UTM) and referrer.
 * Returns traffic channel, source, medium, campaign, content, term
 */
const getTrafficSource = (): Record<string, string | null> | null => {
  try {
    // First check localStorage from original-source plugin
    const stored = localStorage.getItem('__user_original_source__');

    if (stored) {
      // Parse pipe-separated format: "source=google|medium=cpc|campaign=test"
      const parsed: Record<string, string> = {};
      stored.split('|').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value) {
          parsed[key] = decodeURIComponent(value);
        }
      });

      if (Object.keys(parsed).length > 0) {
        const channel = determineChannel(parsed['source'], parsed['medium']);
        return {
          traffic_channel: channel,
          traffic_source: parsed['source'] || null,
          traffic_medium: parsed['medium'] || null,
          traffic_campaign: parsed['campaign'] || null,
          traffic_content: parsed['content'] || null,
          traffic_term: parsed['term'] || null,
          traffic_referrer: stored,
        };
      }
    }

    // Fallback: parse UTM parameters directly from current URL
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('utm_source');
    const medium = urlParams.get('utm_medium');
    const campaign = urlParams.get('utm_campaign');
    const content = urlParams.get('utm_content');
    const term = urlParams.get('utm_term');

    if (source || medium) {
      const channel = determineChannel(source, medium);
      const result: Record<string, string | null> = {
        traffic_channel: channel,
        traffic_source: source,
        traffic_medium: medium,
        traffic_campaign: campaign,
        traffic_content: content,
        traffic_term: term,
        traffic_referrer: document.referrer || null,
      };
      return result;
    }

    return null;
  } catch (_e) {
    // Silent fail - traffic source is optional
    return null;
  }
};

/**
 * Determine traffic channel from source and medium
 */
const determineChannel = (source: string | null, medium: string | null): string => {
  const src = source?.toLowerCase() || '';
  const med = medium?.toLowerCase() || '';

  if (src.includes('chatgpt') || src.includes('claude') || src.includes('bard')) {
    return 'chatbot';
  } else if (med === 'email' || src.includes('mail')) {
    return 'email';
  } else if (med.includes('cpc') || med.includes('ppc') || src === 'google' || src === 'bing') {
    return 'search';
  } else if (med === 'social' || src.match(/facebook|twitter|linkedin|instagram|youtube/)) {
    return 'social';
  } else if (src === '(direct)' && med === '(none)') {
    return 'direct';
  } else if (src.includes(window.location.hostname)) {
    return 'internal';
  } else if (src && src !== '(direct)') {
    return 'referral';
  }

  return 'other';
};

const getBrowserContext = (config: PenguinAnalyticsConfig): Record<string, unknown> => {
  const basicContext = {
    url: window.location.pathname, // Path only (privacy-friendly)
    title: document.title,
  };

  // Enhanced tracking includes browser fingerprinting data
  if (config.enhancedTracking) {
    // Get connection info (Network Information API)
    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    // Get browser info from User-Agent Client Hints API (with fallback)
    const uaData = navigator.userAgentData;
    const primaryBrand =
      uaData?.brands?.find((b) => !b.brand.includes('Not')) || uaData?.brands?.[0];

    // Fallback browser detection from user agent string
    const detectBrowser = (): { name: string; version: string } => {
      const ua = navigator.userAgent;
      if (ua.includes('Firefox/')) {
        const match = ua.match(/Firefox\/(\d+)/);
        return { name: 'Firefox', version: match?.[1] || '' };
      }
      if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        const match = ua.match(/Version\/(\d+)/);
        return { name: 'Safari', version: match?.[1] || '' };
      }
      if (ua.includes('Edg/')) {
        const match = ua.match(/Edg\/(\d+)/);
        return { name: 'Edge', version: match?.[1] || '' };
      }
      if (ua.includes('Chrome/')) {
        const match = ua.match(/Chrome\/(\d+)/);
        return { name: 'Chrome', version: match?.[1] || '' };
      }
      return { name: 'Unknown', version: '' };
    };

    // Fallback platform detection from user agent string
    const detectPlatform = (): string => {
      const ua = navigator.userAgent;
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS';
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('CrOS')) return 'ChromeOS';
      return navigator.platform || 'Unknown';
    };

    const browserFallback = detectBrowser();
    const platformFallback = detectPlatform();

    return {
      ...basicContext,
      url: window.location.href, // Full URL (may include query params)
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
      platform: uaData?.platform || platformFallback,
      browser: primaryBrand?.brand || browserFallback.name,
      browser_version: primaryBrand?.version || browserFallback.version,
      mobile: uaData?.mobile ?? navigator.maxTouchPoints > 0,
      touch_points: navigator.maxTouchPoints,

      // Network info (may not be available in all browsers)
      connection_type: connection?.effectiveType,
      connection_downlink: connection?.downlink,
      connection_rtt: connection?.rtt,
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
    ...eventData,
  };

  // Remove undefined properties
  if (payload.properties) {
    payload.properties = Object.fromEntries(
      Object.entries(payload.properties).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(payload.properties).length === 0) delete payload.properties;
  }

  if (config.debug) console.log('[Analytics]', payload);

  fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err) => config.debug && console.warn('[Analytics] Failed:', err));
};

export function penguinAnalyticsPlugin(pluginConfig: PenguinAnalyticsConfig): AnalyticsPlugin {
  let config = pluginConfig;
  let isActive = false;
  let sessionStart = '';
  let activityInterval: ReturnType<typeof setInterval> | null = null;
  let lastActivity = Date.now();

  const trackActivity = () => {
    lastActivity = Date.now();
  };

  const deferSend = (fn: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
        fn,
      );
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
      deferSend(() =>
        sendEvent(config, {
          eventType: 'Link Clicked',
          properties: {
            link_url: href,
            link_text: link.textContent?.trim().substring(0, 100) || '',
            link_type: href.startsWith('http') || href.startsWith('//') ? 'external' : 'internal',
            path: window.location.pathname,
          },
        }),
      );
      return;
    }

    // Button clicks
    const btn = target.closest('button, [role="button"], input[type="submit"]') as HTMLElement;
    if (btn) {
      deferSend(() =>
        sendEvent(config, {
          eventType: 'Button Clicked',
          properties: {
            button_text:
              btn.textContent?.trim().substring(0, 100) ||
              btn.getAttribute('aria-label') ||
              'unknown',
            button_type: btn.getAttribute('type') || 'button',
            path: window.location.pathname,
          },
        }),
      );
    }
  };

  return {
    name: 'penguin-analytics',
    config: pluginConfig,

    initialize: ({
      config: cfg,
    }: {
      config: PenguinAnalyticsConfig;
      instance: AnalyticsInstance;
    }) => {
      config = cfg;
      document.addEventListener('click', handleClick, { passive: true });
      if (config.debug) console.log('[Analytics] Initialized (anonymous mode)');
    },

    startTracking: () => {
      if (isActive || !config?.apiUrl) return;
      isActive = true;
      sessionStart = new Date().toISOString();

      // Activity tracking
      ['mousemove', 'keydown', 'scroll', 'click'].forEach((e) =>
        document.addEventListener(e, trackActivity, { passive: true }),
      );
      activityInterval = setInterval(() => {
        if (!isActive) return;
        sendEvent(config, {
          eventType: 'User Active',
          properties: {
            url: window.location.href,
            is_active: Date.now() - lastActivity < 60000,
            seconds_since_activity: Math.floor((Date.now() - lastActivity) / 1000),
          },
        });
      }, 30000);

      sendEvent(config, {
        eventType: 'Session Started',
        properties: {
          session_start: sessionStart,
          session_id: getSessionId(),
          ...getBrowserContext(config),
        },
      });

      if (config.debug) console.log('[Analytics] Session started:', getSessionId());
    },

    page: ({ payload }: { payload: Record<string, unknown> }) => {
      if (!isActive) return;

      const props = payload['properties'] as Record<string, unknown> | undefined;

      // Include traffic source data (if available from original-source plugin)
      const trafficSource = getTrafficSource();
      const pageProperties = {
        page_name: props?.['name'] || 'unknown',
        ...getBrowserContext(config),
        ...(trafficSource || {}), // Merge traffic source data
        ...props,
      };

      sendEvent(config, {
        eventType: 'Page Viewed',
        properties: pageProperties,
      });
    },

    track: ({ payload }: { payload: Record<string, unknown> }) => {
      if (!isActive) return;
      sendEvent(config, {
        eventType: payload['event'] as string,
        properties: payload['properties'] as Record<string, unknown>,
      });
    },

    identify: () => {
      /* No-op: no PII collection in eagle-public */
    },

    loaded: () => true,

    reset: () => {
      if (isActive) {
        sendEvent(config, {
          eventType: 'Session Ended',
          properties: {
            session_end: new Date().toISOString(),
            session_start: sessionStart,
            session_id: getSessionId(),
          },
        });
      }
      isActive = false;
      if (activityInterval) clearInterval(activityInterval);
      activityInterval = null;
      ['mousemove', 'keydown', 'scroll', 'click'].forEach((e) =>
        document.removeEventListener(e, trackActivity),
      );
    },
  };
}

export default penguinAnalyticsPlugin;
