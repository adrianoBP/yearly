import { Injectable } from '@angular/core';
import { GoogleAuthService } from './auth.service';
import moment from 'moment';
import { Event } from '../../interfaces/event.interface';

export interface GenericGoogleItemsResponse<T> {
  items: T[];
  nextPageToken?: string;
}

export interface GoogleCalendarSetting {
  etag: string;
  id: string;
  kind: string;
  value: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  summaryOverride?: string;
  timezone: string;
  backgroundColor: string;
  foregroundColor: string;
  accessRole: 'freeBusyReader' | 'owner' | 'reader' | 'writer';
  selected?: boolean;
  primary?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  htmlLink?: string;
  summary: string;
  description?: string;
  location?: string;
  creator: GoogleCalendarEventPerson;
  organizer: GoogleCalendarEventPerson;
  start: GoogleCalendarEventDate;
  end: GoogleCalendarEventDate;
  recurringEventId?: string;
  attendees?: GoogleCalendarEventPerson[];
  eventType: 'birthday' | 'default' | 'focusTime' | 'fromGmail' | 'outOfOffice' | 'workingLocation';
  /** Event's own colour (index into the /colors event palette); unset means the calendar colour */
  colorId?: string;
}

export interface GoogleCalendarEventPerson {
  email: string;
  self: boolean;
  responseStatus?: string;
}

export interface GoogleCalendarEventDate {
  date: string;
  dateTime: string;
  timeZone: string;
}

export interface GoogleCalendarListResponse {
  items: GoogleCalendar[];
}

export interface GoogleCalendarColorsResponse {
  event: { [key: string]: GoogleCalendarColor };
}

export interface GoogleCalendarColor {
  background: string;
  foreground: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  constructor(private googleAuthService: GoogleAuthService) {}

  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  /**
   * cacheOnly: the service worker's copy from the last time this loaded (ngsw-config.json dataGroup "google"),
   * without touching the network; throws when there is none
   */
  private async get<T>(url: string, cacheOnly: boolean): Promise<T> {
    if (!cacheOnly) return this.googleAuthService.makeRequest<T>(url, 'get');
    // ignoreVary: Google varies on Origin, which a bare URL lookup doesn't send
    const saved = await globalThis.caches?.match(url, { ignoreVary: true });
    if (!saved?.ok) throw `Not cached: ${url}`;
    return saved.json();
  }

  async getSettings() {
    const url = `${this.baseUrl}/users/me/settings`;
    const response = await this.googleAuthService.makeRequest<
      GenericGoogleItemsResponse<GoogleCalendarSetting>
    >(url, 'get');
  }

  /** Google's event colour palette: colorId -> background colour */
  async getEventColours(cacheOnly = false): Promise<Record<string, string>> {
    const url = `${this.baseUrl}/colors`;
    const response = await this.get<GoogleCalendarColorsResponse>(url, cacheOnly);
    return Object.fromEntries(
      Object.entries(response.event).map(([id, colour]) => [id, colour.background])
    );
  }

  async getCalendars(cacheOnly = false): Promise<GoogleCalendar[]> {
    const url = `${this.baseUrl}/users/me/calendarList`;
    const response = await this.get<GoogleCalendarListResponse>(url, cacheOnly);
    return response.items;
  }

  async getEvents(start: Date, end: Date, calendarId: string, cacheOnly = false): Promise<GoogleCalendarEvent[]> {
    const queryParameters: { [key: string]: string } = {
      timeMin: moment(start).toISOString(),
      timeMax: moment(end).toISOString(),
      orderBy: 'startTime',
      singleEvents: 'true',
      // Google's largest page: long ranges (Ask your calendar) need far fewer requests
      maxResults: '2500',
      pageToken: '',
    };

    const results: GoogleCalendarEvent[] = [];

    do {
      const query = Object.keys(queryParameters)
        .map((paramKey) => {
          return `${paramKey}=${queryParameters[paramKey]}`;
        })
        .join('&');

      const url = `${this.baseUrl}/calendars/${calendarId}/events?${query}`;

      const response = await this.get<GenericGoogleItemsResponse<GoogleCalendarEvent>>(url, cacheOnly);
      results.push(...response.items);

      queryParameters['pageToken'] = response.nextPageToken || '';
    } while (queryParameters['pageToken'] !== '');

    return results;
  }

  async createEvent(event: Event): Promise<GoogleCalendarEvent> {
    const { start: startDateTime, end: endDateTime } = this.#getEventTime(event);

    const url = `${this.baseUrl}/calendars/${event.calendarId}/events`;
    return await this.googleAuthService.makeRequest<GoogleCalendarEvent>(url, 'post', {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: startDateTime,
      end: endDateTime,
    });
  }

  async deleteEvent(event: Event): Promise<void> {
    const url = `${this.baseUrl}/calendars/${event.calendarId}/events/${event.id}`;
    await this.googleAuthService.makeRequest<void>(url, 'delete');
  }

  async deleteEvents(events: Event[]): Promise<void> {
    for (const event of events) {
      await this.deleteEvent(event);
    }
  }

  async updateEvent(event: Event): Promise<GoogleCalendarEvent> {
    const { start: startDateTime, end: endDateTime } = this.#getEventTime(event);

    const url = `${this.baseUrl}/calendars/${event.calendarId}/events/${event.id}`;
    return await this.googleAuthService.makeRequest<GoogleCalendarEvent>(url, 'patch', {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: startDateTime,
      end: endDateTime,
    });
  }

  async updateEvents(events: Event[]): Promise<void> {
    for (const event of events) {
      await this.updateEvent(event);
    }
  }

  async moveEvent(event: Event, originalCalendarId: string): Promise<GoogleCalendarEvent> {
    const url = `${this.baseUrl}/calendars/${originalCalendarId}/events/${event.id}/move`;
    return await this.googleAuthService.makeRequest<GoogleCalendarEvent>(url, 'post', {
      destination: event.calendarId,
    });
  }

  async moveEvents(events: Event[], originalCalendarId: string): Promise<void> {
    for (const event of events) {
      await this.moveEvent(event, originalCalendarId);
    }
  }

  #getEventTime(event: Event): {
    start: { date: string } | { dateTime: string };
    end: { date: string } | { dateTime: string };
  } {
    const isFullDay =
      event.startMoment.hours() === 0 &&
      event.startMoment.minutes() === 0 &&
      event.endMoment.hours() === 0 &&
      event.endMoment.minutes() === 0;

    const startDateTime = isFullDay
      ? { date: event.startMoment.format('YYYY-MM-DD'), dateTime: null }
      : { dateTime: event.startMoment.toISOString(), date: null };
    const endDateTime = isFullDay
      ? { date: event.endMoment.format('YYYY-MM-DD'), dateTime: null }
      : { dateTime: event.endMoment.toISOString(), date: null };

    return { start: startDateTime, end: endDateTime };
  }
}
