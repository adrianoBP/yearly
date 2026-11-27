import { Injectable } from '@angular/core';
import moment from 'moment';
import { DailyForecast, OpenMeteoDaily, toForecast, upcomingLocations } from '../features/weather';
import { Event } from '../interfaces/event.interface';
import { IntegrationsService } from './integrations.service';

export interface Place {
  lat: number;
  lon: number;
  /** ISO 3166-1 alpha-2, upper case */
  country: string;
}

/** Open-Meteo forecasts reach 16 days ahead */
export const FORECAST_DAYS = 16;
const DAY = 24 * 60 * 60 * 1000;
/** Places looked up ahead of time per load: each new one is a request to OpenStreetMap */
const MAX_PREFETCH = 20;

/** Places (OpenStreetMap Nominatim) and forecasts (Open-Meteo): both free, no key */
@Injectable()
export class WeatherService {
  constructor(private integrations: IntegrationsService) {}

  async geocode(location: string): Promise<Place | null> {
    const query = location.trim();
    if (!query) return null;
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=' + encodeURIComponent(query);
    // Places don't move: cache for a month, which also keeps us inside Nominatim's fair-use policy
    const [result] = await this.integrations.fetchCached<
      { lat: string; lon: string; address?: { country_code?: string } }[]
    >(url, `place:${query.toLowerCase()}`, 30 * DAY);
    if (result) return { lat: +result.lat, lon: +result.lon, country: (result.address?.country_code ?? '').toUpperCase() };
    // Nominatim wants exact names ("Nando's"); Photon, on the same OpenStreetMap data, forgives typos
    const photon = await this.integrations.fetchCached<{
      features: { geometry: { coordinates: [number, number] }; properties: { countrycode?: string } }[];
    }>('https://photon.komoot.io/api/?limit=1&q=' + encodeURIComponent(query), `photon:${query.toLowerCase()}`, 30 * DAY);
    const [feature] = photon.features ?? [];
    if (!feature) {
      // Streets missing from the map ("6 Merchants Walk, …"): a UK postcode alone still pins the right street
      const postcode = query.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0].toUpperCase();
      const fallback = postcode && `${postcode}, UK`;
      return fallback && fallback !== query ? this.geocode(fallback) : null;
    }
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lon, country: (feature.properties.countrycode ?? '').toUpperCase() };
  }

  /** Daily forecast for the part of [start, end) that's within reach; null when none of it is */
  async forecast(place: Place, start: moment.Moment, end: moment.Moment): Promise<DailyForecast[] | null> {
    const today = moment().startOf('day');
    const from = moment.max(start.clone().startOf('day'), today);
    // end is exclusive: an all-day event ending at midnight doesn't include that day
    const to = moment.min(end.clone().subtract(1, 'ms').startOf('day'), today.clone().add(FORECAST_DAYS - 1, 'days'));
    if (to.isBefore(from)) return null;

    // The place's whole forecast, not just these dates: every event there shares one saved copy,
    // which an offline device still finds on later days (the stale fallback in fetchCached)
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(3)}&longitude=${place.lon.toFixed(3)}` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max' +
      `&timezone=auto&forecast_days=${FORECAST_DAYS}`;
    const response = await this.integrations.fetchCached<{ daily: OpenMeteoDaily }>(url, `forecast:${url}`, 60 * 60 * 1000);
    const [first, last] = [from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD')];
    const days = toForecast(response.daily).filter((day) => day.date >= first && day.date <= last);
    return days.length ? days : null;
  }

  private prefetching = false;

  /** Saves the forecast of every upcoming event's place, so opening one offline still shows its weather */
  async prefetch(events: Event[]) {
    if (this.prefetching || !navigator.onLine) return;
    this.prefetching = true;
    const today = moment().startOf('day');
    try {
      for (const location of upcomingLocations(events, moment(), FORECAST_DAYS, MAX_PREFETCH)) {
        try {
          const place = await this.geocode(location);
          if (place) await this.forecast(place, today, today.clone().add(FORECAST_DAYS, 'days'));
        } catch {
          // That place just has no saved forecast
        }
        // OpenStreetMap's place search asks for no more than one request a second
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      this.prefetching = false;
    }
  }
}
