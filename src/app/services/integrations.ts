export type ProviderId = 'gemini' | 'tomtom' | 'ticketmaster' | 'aviationstack' | 'footballdata';
export type UsagePeriod = 'day' | 'month';

export interface Provider {
  id: ProviderId;
  name: string;
  keyUrl: string;
  steps: string;
  /** Free-tier allowance per period; undefined when the provider doesn't publish a fixed number */
  limit?: number;
  limitNote?: string;
  period: UsagePeriod;
  /** Cheap request that proves the key works */
  test?: (key: string) => { url: string; headers?: Record<string, string> };
  /**
   * Browsers can't call some APIs directly (no CORS). 'always' goes through the Yearly server
   * (see server/yearly-server.mjs); 'fallback' tries the browser first.
   */
  server?: 'always' | 'fallback';
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    steps: 'Sign in with Google, then choose "Create API key". The free tier needs no card.',
    period: 'day',
    limitNote: 'Free limits are shown in Google AI Studio. Free-tier requests may be used by Google to improve its models.',
    test: (key) => ({ url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}` }),
  },
  {
    id: 'tomtom',
    name: 'TomTom',
    keyUrl: 'https://developer.tomtom.com',
    steps: 'Sign up, open the Dashboard, then Keys. A first key is created for you. No card needed.',
    // shortcut: TomTom documents both a daily and a monthly free quota; update once confirmed
    limit: 2500,
    period: 'day',
    test: (key) => ({
      url: `https://api.tomtom.com/search/2/geocode/London.json?limit=1&key=${encodeURIComponent(key)}`,
    }),
  },
  {
    id: 'ticketmaster',
    name: 'Ticketmaster',
    keyUrl: 'https://developer.ticketmaster.com',
    steps: 'Sign up, open My Apps, then copy the Consumer Key.',
    limit: 5000,
    period: 'day',
    server: 'fallback',
    test: (key) => ({
      url: `https://app.ticketmaster.com/discovery/v2/events.json?size=1&apikey=${encodeURIComponent(key)}`,
    }),
  },
  {
    id: 'footballdata',
    name: 'football-data.org',
    keyUrl: 'https://www.football-data.org/client/register',
    steps: 'Register for the free plan. The API token arrives by email.',
    limitNote: 'Free plan: 10 requests a minute; covers the Premier League, Championship and other top leagues.',
    period: 'day',
    server: 'always',
    test: (key) => ({ url: 'https://api.football-data.org/v4/competitions/PL', headers: { 'X-Auth-Token': key } }),
  },
  {
    id: 'aviationstack',
    name: 'Aviationstack',
    keyUrl: 'https://aviationstack.com',
    steps: 'Choose "Sign up free". The Access Key is on your dashboard.',
    limitNote: 'Testing the key uses 1 of the 100 free monthly requests.',
    limit: 100,
    period: 'month',
    test: (key) => ({ url: `https://api.aviationstack.com/v1/flights?limit=1&access_key=${encodeURIComponent(key)}` }),
  },
];

export interface Feature {
  id: string;
  name: string;
  description: string;
  /** Every group must have at least one key set; empty means no key needed */
  keys: ProviderId[][];
  /** Keys that add to the feature; without them it runs in its basic form (see basic) */
  optionalKeys?: ProviderId[][];
  /** What's missing in the basic form */
  basic?: string;
  /** false until the feature is built */
  available: boolean;
}

export const FEATURES: Feature[] = [
  { id: 'text-events', name: 'Create events from text', description: `Type "dinner Friday 8pm at Rosie's" to fill in a new event.`, keys: [], available: true },
  { id: 'search', name: 'Quick search', description: 'Press Ctrl+K or / to find events, jump to a date or open a tool.', keys: [], available: true },
  { id: 'countdowns', name: 'Countdowns', description: 'Pin an event to see the days left at the top of the calendar.', keys: [], available: true },
  { id: 'drag-events', name: 'Drag on the calendar', description: 'With a mouse, drag across days to create an event, or drag an event to move it.', keys: [], available: true },
  { id: 'app-badge', name: 'Today badge', description: `Shows how many of today's events are left on the installed app's icon: computers with Chrome or Edge, and iPhone or iPad once notifications are on. Not on Android.`, keys: [], available: true },
  {
    id: 'flights',
    name: 'Flight details',
    description: 'Airline, airports and times for events with a flight number.',
    keys: [],
    optionalKeys: [['aviationstack']],
    basic: 'Live gate, delay and status need a free Aviationstack key.',
    available: true,
  },
  { id: 'weather', name: 'Weather warnings', description: 'Forecast warnings for events with a location.', keys: [], available: true },
  { id: 'leave-planner', name: 'Leave planner', description: 'Bank holidays and the best days to take off.', keys: [], available: true },
  { id: 'year-review', name: 'Year in review', description: 'Charts of your year: busy days, months, places and more.', keys: [], available: true },
  {
    id: 'travel-buffers',
    name: 'Travel buffers',
    description: `Warns when there isn't enough time to get from one event to the next.`,
    keys: [['tomtom']],
    available: true,
  },
  {
    id: 'crowd-alerts',
    name: 'Crowd and traffic alerts',
    description: 'Warns when a concert or match near your venue may slow you down.',
    keys: [['ticketmaster', 'footballdata']],
    optionalKeys: [['tomtom']],
    basic: 'Travel time from home needs a free TomTom key and your home address.',
    available: true,
  },
  {
    id: 'ask-calendar',
    name: 'Ask your calendar',
    description: 'Ask questions like "when is my next free weekend?".',
    keys: [['gemini']],
    available: true,
  },
];

export type FeatureStatus = 'soon' | 'off' | 'ready' | 'basic' | 'needs-key';

/** Required key groups that still have no usable key */
export function missingKeys(feature: Feature, hasKey: (id: ProviderId) => boolean): ProviderId[][] {
  return feature.keys.filter((group) => !group.some(hasKey));
}

export function featureStatus(feature: Feature, enabled: boolean, hasKey: (id: ProviderId) => boolean): FeatureStatus {
  if (!feature.available) return 'soon';
  // A missing key outranks "off": the switch is locked, so the badge must say why
  if (missingKeys(feature, hasKey).length > 0) return 'needs-key';
  if (!enabled) return 'off';
  const optionalMissing = (feature.optionalKeys ?? []).some((group) => !group.some(hasKey));
  return optionalMissing ? 'basic' : 'ready';
}

/** Only features that can actually run may be switched on */
export function canToggle(status: FeatureStatus) {
  return status !== 'soon' && status !== 'needs-key';
}

// shortcut: periods are counted in UTC, but providers reset on their own clock (Gemini: Pacific midnight); use provider-reported usage when available
export function periodKey(period: UsagePeriod, date: Date): string {
  const iso = date.toISOString();
  return period === 'day' ? iso.slice(0, 10) : iso.slice(0, 7);
}

export function periodResetDate(period: UsagePeriod, date: Date): Date {
  return period === 'day'
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
    : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}
