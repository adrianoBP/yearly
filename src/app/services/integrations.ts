export type ProviderId = 'gemini' | 'tomtom' | 'ticketmaster' | 'aviationstack' | 'aeroapi';
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
  /** Cheap request that proves the key works; undefined when the browser can't reach the provider */
  test?: (key: string) => { url: string; headers?: Record<string, string> };
  testNote?: string;
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
    test: (key) => ({
      url: `https://app.ticketmaster.com/discovery/v2/events.json?size=1&apikey=${encodeURIComponent(key)}`,
    }),
  },
  {
    id: 'aviationstack',
    name: 'Aviationstack',
    keyUrl: 'https://aviationstack.com',
    steps: 'Choose "Sign up free". The Access Key is on your dashboard.',
    limit: 100,
    period: 'month',
    testNote: "The free plan is HTTP-only, so browsers block it. It can't be tested from here yet.",
  },
  {
    id: 'aeroapi',
    name: 'FlightAware AeroAPI',
    keyUrl: 'https://www.flightaware.com/aeroapi/portal',
    steps: 'Sign in, choose the Personal tier, then open API Keys.',
    period: 'month',
    limitNote: 'Free allowance is shown in the AeroAPI portal.',
    test: (key) => ({ url: 'https://aeroapi.flightaware.com/aeroapi/account/usage', headers: { 'x-apikey': key } }),
  },
];

export interface Feature {
  id: string;
  name: string;
  description: string;
  /** Every group must have at least one key set; empty means no key needed */
  keys: ProviderId[][];
  /** Works in a reduced form when keys are missing */
  basic?: string;
  /** false until the feature is built */
  available: boolean;
}

export const FEATURES: Feature[] = [
  { id: 'text-events', name: 'Create events from text', description: 'Type "dinner Friday 8pm at Rosie\'s" to fill in a new event.', keys: [], available: false },
  {
    id: 'flights',
    name: 'Flight details',
    description: 'Airline, airports and times for events with a flight number.',
    keys: [['aviationstack', 'aeroapi']],
    basic: 'Live gate, delay and status need a free Aviationstack or AeroAPI key.',
    available: false,
  },
  { id: 'weather', name: 'Weather warnings', description: 'Forecast warnings for events with a location.', keys: [], available: false },
  { id: 'leave-planner', name: 'Leave planner', description: 'Bank holidays and the best days to take off.', keys: [], available: false },
  { id: 'trip-prep', name: 'Trip prep checklist', description: 'A checklist based on trip length, destination and forecast.', keys: [], available: false },
  { id: 'year-review', name: 'Year in review', description: 'Trips, busiest month and places visited.', keys: [], available: false },
  { id: 'travel-buffers', name: 'Travel buffers', description: 'Warns when back-to-back events are too far apart.', keys: [['tomtom']], available: false },
  {
    id: 'crowd-alerts',
    name: 'Crowd and traffic alerts',
    description: 'Warns when a big event near your venue may slow you down.',
    keys: [['ticketmaster'], ['tomtom']],
    available: false,
  },
  { id: 'ask-calendar', name: 'Ask your calendar', description: 'Ask questions like "when is my next free weekend?".', keys: [['gemini']], available: false },
];

export type FeatureStatus = 'soon' | 'off' | 'ready' | 'basic' | 'needs-key';

/** Key groups that still have no key set */
export function missingKeys(feature: Feature, hasKey: (id: ProviderId) => boolean): ProviderId[][] {
  return feature.keys.filter((group) => !group.some(hasKey));
}

export function featureStatus(feature: Feature, enabled: boolean, hasKey: (id: ProviderId) => boolean): FeatureStatus {
  if (!feature.available) return 'soon';
  const missing = missingKeys(feature, hasKey).length > 0;
  // A missing key outranks "off": the switch is locked, so the badge must say why
  if (missing && !feature.basic) return 'needs-key';
  if (!enabled) return 'off';
  return missing ? 'basic' : 'ready';
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
