import { Injectable } from '@angular/core';
import { GoogleCalendar, GoogleCalendarEvent } from '../google/calendar.service';
import { SocialUser } from '@abacritt/angularx-social-login';
import { Event } from '../../interfaces/event.interface';

@Injectable({ providedIn: 'root' })
export class MockCalendarService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  constructor() {}

  async getCalendars(): Promise<GoogleCalendar[]> {
    return JSON.parse(
      '[{"kind":"calendar#calendarListEntry","id":"en.uk#holiday@group.v.calendar.google.com","summary":"Holidays in United Kingdom","description":"Holidays and Observances in United Kingdom","timeZone":"Europe/London","summaryOverride":"Holidays in United Kingdom","backgroundColor":"#16a765","foregroundColor":"#000000","selected":true,"accessRole":"reader"},{"kind":"calendar#calendarListEntry","id":"4d1b7dfc474eb4a3c926b2a202519f3d530f5f95894528233c35119a22d24a3d@group.calendar.google.com","summary":"Travels","timeZone":"Europe/London","backgroundColor":"#9fe1e7","foregroundColor":"#000000","selected":true,"accessRole":"owner"},{"kind":"calendar#calendarListEntry","id":"adriano.boccardo@gmail.com","summary":"adriano.boccardo@gmail.com","timeZone":"Europe/London","backgroundColor":"#b99aff","foregroundColor":"#000000","selected":true,"accessRole":"owner","primary":true},{"kind":"calendar#calendarListEntry","id":"adriano.pochettino@linnworks.com","summary":"adriano.pochettino@linnworks.com","timeZone":"Europe/London","summaryOverride":"Linnworks","backgroundColor":"#4986e7","foregroundColor":"#000000","selected":true,"accessRole":"freeBusyReader"}]'
    );
  }

  async getEvents(start: Date, end: Date, calendarId: string): Promise<GoogleCalendarEvent[]> {
    if (calendarId != 'adriano.boccardo@gmail.com') return [];
    return JSON.parse(
      '[{"kind":"calendar#event","id":"_d9t6urabel24mnpif4r5kmb69hi48gadc8","status":"confirmed","created":"2024-10-28T18:34:34.000Z","updated":"2024-10-28T18:36:03.145Z","summary":"🩸 Blood donation","description":"Check you can donate - it could save you time on the day or even a wasted journey.","organizer":{"email":"adriano.boccardo@gmail.com","self":true},"start":{"dateTime":"2024-11-05T19:15:00Z","timeZone":"UTC"},"end":{"dateTime":"2024-11-05T20:15:00Z","timeZone":"UTC"},"eventType":"default"},{"kind":"calendar#event","id":"cqe014leg5vigkbfsa3tjgurrc","status":"confirmed","created":"2024-10-19T20:58:26.000Z","updated":"2024-10-25T17:26:27.799Z","summary":"Arcane with Cris (?)","description":"\\n~🗃️~","organizer":{"email":"adriano.boccardo@gmail.com","self":true},"start":{"date":"2024-09-15"},"end":{"date":"2025-11-17"},"eventType":"default"}]'
    );
  }

  async createEvent(event: Event): Promise<GoogleCalendarEvent> {
    return {} as GoogleCalendarEvent;
  }

  async deleteEvent(event: Event): Promise<void> {
    return;
  }

  async deleteEvents(events: Event[]): Promise<void> {
    for (const event of events) {
      await this.deleteEvent(event);
    }
  }

  async updateEvent(event: Event): Promise<void> {}

  async updateEvents(events: Event[]): Promise<void> {}

  async moveEvent(event: Event, originalCalendarId: string): Promise<void> {}

  async moveEvents(events: Event[], originalCalendarId: string): Promise<void> {}
}
