import { Injectable } from '@angular/core';
import { SocialUser } from '@abacritt/angularx-social-login';
import { GoogleAuthService } from './auth.service';
import moment from 'moment';

export interface GoogleCalendar {
  id: string;
  etag: string;
  summary: string;
  summaryOverride?: string;
  timezone: string;
  backgroundColor: string;
  foregroundColor: string;
  colorId: string;
  accessRole: string;
}

export interface GoogleCalendarEvent {
  id: string;
  htmlLink?: string;
  summary: string;
  description?: string;
  colorId?: string;
  creator: GoogleCalendarEventPerson;
  organizer: GoogleCalendarEventPerson;
  start: GoogleCalendarEventDate;
  end: GoogleCalendarEventDate;
}

export interface GoogleCalendarEventPerson {
  email: string;
  self: boolean;
}

export interface GoogleCalendarEventDate {
  date: string;
  dateTime: string;
}

export interface GoogleCalendarListResponse {
  items: GoogleCalendar[];
}

export interface GoogleCalendarEventListResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
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
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  constructor(private googleAuthService: GoogleAuthService) {}

  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  async getCalendars(): Promise<GoogleCalendar[]> {
    const url = `${this.baseUrl}/users/me/calendarList`;
    const response =
      await this.googleAuthService.makeRequest<GoogleCalendarListResponse>(
        url,
        'get'
      );
    return response.items;
  }

  async getColors(): Promise<{ [key: string]: GoogleCalendarColor }> {
    const url = `${this.baseUrl}/colors`;
    const response =
      await this.googleAuthService.makeRequest<GoogleCalendarColorsResponse>(
        url,
        'get'
      );
    return response.event;
  }

  async getEvents(
    start: Date,
    end: Date,
    calendarId: string
  ): Promise<GoogleCalendarEvent[]> {
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

      const response =
        await this.googleAuthService.makeRequest<GoogleCalendarEventListResponse>(
          url,
          'get'
        );
      results.push(...response.items);

      queryParameters['pageToken'] = response.nextPageToken || '';
    } while (queryParameters['pageToken'] !== '');

    return results;
  }

  async getEventsOLD(start: Date, end: Date): Promise<GoogleCalendarEvent[]> {
    const queryParameters: { [key: string]: string } = {
      q: '🗃️',
      timeMin: moment(start).toISOString(),
      timeMax: moment(end).toISOString(),
      orderBy: 'startTime',
      singleEvents: 'true',
      pageToken: '',
    };

    const results: GoogleCalendarEvent[] = [];

    let pageToken = '';
    do {
      const query = Object.keys(queryParameters)
        .map((paramKey) => {
          return `${paramKey}=${queryParameters[paramKey]}`;
        })
        .join('&');

      const url = `${this.baseUrl}/calendars/primary/events?${query}`;
      const response =
        await this.googleAuthService.makeRequest<GoogleCalendarEventListResponse>(
          url,
          'get'
        );
      results.push(...response.items);
    } while (pageToken !== '');

    return results;
  }

  async createEvent(event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> {
    const url = `${this.baseUrl}/calendars/primary/events`;
    const response =
      await this.googleAuthService.makeRequest<GoogleCalendarEvent>(
        url,
        'post',
        {
          summary: event.summary,
          description: event.description,
          start: {
            date: event.start.date,
          },
          end: {
            date: event.end.date,
          },
          colorId: event.colorId,
        }
      );
    return response;
  }

  async createEvents(events: GoogleCalendarEvent[]): Promise<void> {
    for (const event of events) {
      await this.createEvent(event);
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    const url = `${this.baseUrl}/calendars/primary/events/${eventId}`;
    await this.googleAuthService.makeRequest<void>(url, 'delete');
  }

  async deleteEvents(eventIds: string[]): Promise<void> {
    for (const eventId of eventIds) {
      await this.deleteEvent(eventId);
    }
  }
}
