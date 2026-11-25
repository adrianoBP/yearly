import { Event } from '../interfaces/event.interface';

export interface Point {
  lat: number;
  lon: number;
}

export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Geohash, which Ticketmaster takes as its search point (latlong is deprecated there) */
export function geohash(lat: number, lon: number, precision = 7): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  const range = { lat: [-90, 90], lon: [-180, 180] };
  let hash = '';
  let bits = 0;
  let value = 0;
  let even = true;
  while (hash.length < precision) {
    const [axis, coordinate] = even ? (['lon', lon] as const) : (['lat', lat] as const);
    const mid = (range[axis][0] + range[axis][1]) / 2;
    value <<= 1;
    if (coordinate >= mid) {
      value |= 1;
      range[axis][0] = mid;
    } else {
      range[axis][1] = mid;
    }
    even = !even;
    if (++bits === 5) {
      hash += base32[value];
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

function isTimed(e: Event) {
  return !(e.startMoment.format('HH:mm') === '00:00' && e.endMoment.format('HH:mm') === '00:00');
}

/** The timed events with a place right before and after this one on the same day */
export function neighbours(event: Pick<Event, 'id' | 'startMoment' | 'endMoment'>, others: Event[]) {
  const sameDay = others.filter(
    (e) => e.id !== event.id && isTimed(e) && !!e.location?.trim() && e.startMoment.isSame(event.startMoment, 'day')
  );
  const before = sameDay
    .filter((e) => !e.endMoment.isAfter(event.startMoment))
    .sort((a, b) => b.endMoment.valueOf() - a.endMoment.valueOf())[0];
  const after = sameDay
    .filter((e) => !e.startMoment.isBefore(event.endMoment))
    .sort((a, b) => a.startMoment.valueOf() - b.startMoment.valueOf())[0];
  return { before, after };
}

export type Verdict = 'ok' | 'tight' | 'late';

/** Late when the trip is longer than the gap; tight when less than 10 minutes would be left over */
export function bufferVerdict(gapMinutes: number, travelMinutes: number): Verdict {
  if (travelMinutes > gapMinutes) return 'late';
  return gapMinutes - travelMinutes < 10 ? 'tight' : 'ok';
}

/** TomTom Calculate Route response, the part used here */
export interface TomTomRoute {
  routes?: { summary: { travelTimeInSeconds: number; trafficDelayInSeconds?: number; lengthInMeters: number } }[];
}

export function routeSummary(response: TomTomRoute) {
  const summary = response.routes?.[0]?.summary;
  if (!summary) return null;
  return {
    minutes: Math.round(summary.travelTimeInSeconds / 60),
    trafficMinutes: Math.round((summary.trafficDelayInSeconds ?? 0) / 60),
    km: Math.round(summary.lengthInMeters / 100) / 10,
  };
}
