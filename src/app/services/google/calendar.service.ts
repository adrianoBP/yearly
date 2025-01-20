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
  creator: GoogleCalendarEventPerson;
  organizer: GoogleCalendarEventPerson;
  start: GoogleCalendarEventDate;
  end: GoogleCalendarEventDate;
  recurringEventId?: string;
  attendees?: GoogleCalendarEventPerson[];
  eventType: 'birthday' | 'default' | 'focusTime' | 'fromGmail' | 'outOfOffice' | 'workingLocation';
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

  async getSettings() {
    const url = `${this.baseUrl}/users/me/settings`;
    const response = await this.googleAuthService.makeRequest<
      GenericGoogleItemsResponse<GoogleCalendarSetting>
    >(url, 'get');
  }

  async getCalendars(): Promise<GoogleCalendar[]> {
    const url = `${this.baseUrl}/users/me/calendarList`;
    const response = await this.googleAuthService.makeRequest<GoogleCalendarListResponse>(
      url,
      'get'
    );
    return response.items;
  }

  async getEvents(start: Date, end: Date, calendarId: string): Promise<GoogleCalendarEvent[]> {
    const queryParameters: { [key: string]: string } = {
      timeMin: moment(start).toISOString(),
      timeMax: moment(end).toISOString(),
      orderBy: 'startTime',
      singleEvents: 'true',
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

      const response = await this.googleAuthService.makeRequest<
        GenericGoogleItemsResponse<GoogleCalendarEvent>
      >(url, 'get');
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
