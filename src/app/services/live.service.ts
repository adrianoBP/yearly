import { Injectable } from '@angular/core';
import moment from 'moment';
import { AskTurn, GeminiModel, GeminiResponse, FALLBACK_MODEL, answerText, buildRequest, pickModel } from '../features/ask';
import { CROWD_RADIUS_KM, FootballResponse, NearbyEvent, TicketmasterResponse, footballCandidates, ticketmasterNearby } from '../features/crowd';
import { AviationstackResponse, FlightStatus, parseAviationstack } from '../features/flight-status';
import { TomTomRoute, distanceKm, geohash, routeSummary } from '../features/travel';
import { CalendarInfo } from '../features/year-review';
import { Event } from '../interfaces/event.interface';
import { IntegrationsService } from './integrations.service';
import { WeatherService } from './weather.service';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** The phase 4 features: each call uses the user's own free key and the shared cache and usage counter */
@Injectable()
export class LiveService {
  constructor(
    private integrations: IntegrationsService,
    private places: WeatherService
  ) {}

  // -- Flight status (Aviationstack) --

  /** Status of e.g. "FR 1234" on date (YYYY-MM-DD); cached for an hour unless refresh */
  async flightStatus(flight: string, date: string, refresh = false): Promise<{ status: FlightStatus | null; at: number }> {
    const code = flight.replace(/\s/g, '');
    const cacheKey = `flight:${code}:${date}`;
    const key = encodeURIComponent(this.integrations.getKey('aviationstack') ?? '');
    const response = await this.integrations.request<AviationstackResponse>(
      'aviationstack',
      `https://api.aviationstack.com/v1/flights?flight_iata=${code}&access_key=${key}`,
      { cacheKey, ttlMs: refresh ? 0 : HOUR }
    );
    return { status: parseAviationstack(response, date), at: this.integrations.cachedAt(cacheKey) ?? Date.now() };
  }

  // -- Driving time (TomTom, with traffic) --

  /** Driving time between two addresses leaving at departAt (or now, if that's past); null if either place is unknown */
  async route(from: string, to: string, departAt: Date) {
    // One at a time: OpenStreetMap's place search asks for no more than one request a second
    const a = await this.places.geocode(from);
    const b = a && (await this.places.geocode(to));
    if (!a || !b) return null;
    if (distanceKm(a, b) < 0.2) return { minutes: 0, trafficMinutes: 0, km: 0 };

    const depart = moment.max(moment(departAt), moment().add(1, 'minute'));
    const points = `${a.lat.toFixed(5)},${a.lon.toFixed(5)}:${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
    const key = encodeURIComponent(this.integrations.getKey('tomtom') ?? '');
    const response = await this.integrations.request<TomTomRoute>(
      'tomtom',
      `https://api.tomtom.com/routing/1/calculateRoute/${points}/json?traffic=true&travelMode=car` +
        `&departAt=${encodeURIComponent(depart.format('YYYY-MM-DDTHH:mm:ssZ'))}&key=${key}`,
      // Same trip within a quarter of an hour reuses the answer
      { cacheKey: `route:${points}:${depart.format('YYYY-MM-DDTHH')}:${Math.floor(depart.minute() / 15)}`, ttlMs: 30 * MINUTE }
    );
    return routeSummary(response);
  }

  // -- Crowds near a venue (Ticketmaster, football-data.org) --

  /** Concerts, shows and matches within a few km and hours of the event; the user's own show is left out */
  async nearby(location: string, title: string, start: Date): Promise<NearbyEvent[]> {
    const place = await this.places.geocode(location);
    if (!place) return [];
    const found: NearbyEvent[] = [];

    if (this.integrations.canUse('ticketmaster')) {
      const utc = (offsetHours: number) => moment(start).add(offsetHours, 'hours').utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
      const point = geohash(place.lat, place.lon, 7);
      const key = encodeURIComponent(this.integrations.getKey('ticketmaster') ?? '');
      const response = await this.integrations.request<TicketmasterResponse>(
        'ticketmaster',
        `https://app.ticketmaster.com/discovery/v2/events.json?geoPoint=${point}&radius=${CROWD_RADIUS_KM}&unit=km` +
          `&startDateTime=${utc(-3)}&endDateTime=${utc(3)}&size=50&sort=date,asc&apikey=${key}`,
        { cacheKey: `tm:${point}:${moment(start).format('YYYY-MM-DDTHH')}`, ttlMs: 6 * HOUR }
      );
      found.push(...ticketmasterNearby(response, start, `${location} ${title}`));
    }

    if (this.integrations.canUse('footballdata')) {
      const day = moment(start).format('YYYY-MM-DD');
      const response = await this.integrations.request<FootballResponse>(
        'footballdata',
        `https://api.football-data.org/v4/matches?dateFrom=${day}&dateTo=${day}`,
        { headers: { 'X-Auth-Token': this.integrations.getKey('footballdata') ?? '' }, cacheKey: `fd:${day}`, ttlMs: 6 * HOUR }
      );
      for (const match of footballCandidates(response, start, place.country)) {
        const venue = await this.places.geocode(match.venue);
        const km = venue ? distanceKm(place, venue) : Infinity;
        if (km <= CROWD_RADIUS_KM) found.push({ ...match, distanceKm: Math.round(km * 10) / 10 });
      }
    }

    return found.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // -- Ask your calendar (Gemini) --

  async ask(question: string, events: Event[], calendars: CalendarInfo[], history: AskTurn[] = []): Promise<string> {
    const key = encodeURIComponent(this.integrations.getKey('gemini') ?? '');
    const base = 'https://generativelanguage.googleapis.com/v1beta';
    let model = FALLBACK_MODEL;
    try {
      // Google renames and retires models often; pick from what this key can use today
      const list = await this.integrations.request<{ models?: GeminiModel[] }>('gemini', `${base}/models?pageSize=200&key=${key}`, {
        cacheKey: 'gemini:models',
        ttlMs: 24 * HOUR,
      });
      model = pickModel(list.models ?? []);
    } catch {
      // Fall back to the default model
    }
    const response = await this.integrations.request<GeminiResponse>('gemini', `${base}/${model}:generateContent?key=${key}`, {
      body: buildRequest(question, events, calendars, undefined, history),
    });
    return answerText(response);
  }
}
