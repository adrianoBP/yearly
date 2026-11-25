/** A concert, match or show near the user's event */
export interface NearbyEvent {
  name: string;
  venue: string;
  start: Date;
  kind: string;
  distanceKm?: number;
}

/** Only crowds starting within this many hours of the user's event matter for traffic */
export const CROWD_WINDOW_HOURS = 3;
/** And within this distance of the venue */
export const CROWD_RADIUS_KM = 3;

export function withinWindow(start: Date, eventStart: Date) {
  return Math.abs(start.getTime() - eventStart.getTime()) <= CROWD_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Ticketmaster Discovery API event search, the parts used here */
export interface TicketmasterResponse {
  _embedded?: {
    events?: {
      name: string;
      dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string } };
      classifications?: { segment?: { name?: string } }[];
      _embedded?: { venues?: { name?: string; location?: { latitude?: string | number; longitude?: string | number } }[] };
    }[];
  };
}

/**
 * Events from Ticketmaster near the user's event, minus the user's own (a theatre show the user is going
 * to is listed too: same venue as the event's location or title).
 */
export function ticketmasterNearby(response: TicketmasterResponse, eventStart: Date, ownText: string): NearbyEvent[] {
  const own = ownText.toLowerCase();
  const seen = new Set<string>();
  return (response._embedded?.events ?? [])
    .map((e) => {
      const venue = e._embedded?.venues?.[0]?.name ?? '';
      const start = e.dates?.start?.dateTime
        ? new Date(e.dates.start.dateTime)
        : new Date(`${e.dates?.start?.localDate}T${e.dates?.start?.localTime ?? '19:00:00'}`);
      return { name: e.name, venue, start, kind: e.classifications?.[0]?.segment?.name ?? 'Event' };
    })
    .filter((e) => !isNaN(e.start.getTime()) && withinWindow(e.start, eventStart))
    .filter((e) => !(e.venue && own.includes(e.venue.toLowerCase())))
    .filter((e) => {
      const key = `${e.name}|${e.venue}`;
      return !seen.has(key) && !!seen.add(key);
    });
}

/** football-data.org v4 /matches, the parts used here */
export interface FootballResponse {
  matches?: {
    utcDate: string;
    venue?: string | null;
    area?: { code?: string };
    competition?: { name?: string };
    homeTeam?: { name?: string; shortName?: string };
    awayTeam?: { name?: string; shortName?: string };
  }[];
}

/** football-data.org area codes for a country (ISO 3166 alpha-2); Europe-wide cups are always included */
const AREAS: Record<string, string[]> = {
  GB: ['ENG', 'SCO', 'WAL', 'NIR'],
  DE: ['GER', 'DEU'],
  ES: ['ESP'],
  IT: ['ITA'],
  NL: ['NED'],
  PT: ['POR'],
  FR: ['FRA'],
  BR: ['BRA'],
};

/** Matches in the user's country around the event's time that have a known venue; the caller checks the distance */
export function footballCandidates(response: FootballResponse, eventStart: Date, country: string) {
  const areas = [...(AREAS[country] ?? [country]), 'EUR', 'WOR'];
  return (response.matches ?? [])
    .filter((m) => !!m.venue && (!m.area?.code || areas.includes(m.area.code)))
    .map((m) => ({
      name: `${m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?'} v ${m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?'}`,
      venue: m.venue!,
      start: new Date(m.utcDate),
      kind: m.competition?.name ?? 'Football',
    }))
    .filter((m) => withinWindow(m.start, eventStart));
}

/** When to set off: the drive, a 10-minute margin, and 20 more minutes when crowds are expected */
export function leaveBy(eventStart: Date, travelMinutes: number, crowded: boolean): Date {
  const minutes = travelMinutes + 10 + (crowded ? 20 : 0);
  return new Date(eventStart.getTime() - minutes * 60 * 1000);
}
