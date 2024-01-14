import { Injectable } from '@angular/core';
import { SocialUser } from '@abacritt/angularx-social-login';
import { GoogleAuthService } from './auth.service';
import { HttpService } from '../http.service';
import moment from 'moment';

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
}

interface GoogleCalendarEventListResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  constructor(
    private googleAuthService: GoogleAuthService,
    private httpService: HttpService
  ) {}

  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  async getEvents(start: Date, end: Date): Promise<GoogleCalendarEvent[]> {
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
        await this.httpService.get<GoogleCalendarEventListResponse>(url, {
          Authorization: `Bearer ${this.googleAuthService.accessToken}`,
        });

      results.push(...response.items);
    } while (pageToken !== '');

    return results;
  }
}
