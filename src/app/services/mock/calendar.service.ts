import { Injectable } from '@angular/core';
import {
  GoogleCalendar,
  GoogleCalendarColor,
  GoogleCalendarEvent,
  GoogleCalendarEventListResponse,
  GoogleCalendarListResponse,
} from '../google/calendar.service';
import { SocialUser } from '@abacritt/angularx-social-login';

@Injectable({ providedIn: 'root' })
export class MockCalendarService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  constructor() {}

  async getColors(): Promise<{ [key: string]: GoogleCalendarColor }> {
    return {
      '1': { background: '#a4bdfc', foreground: '#1d1d1d' },
      '2': { background: '#7ae7bf', foreground: '#1d1d1d' },
      '3': { background: '#dbadff', foreground: '#1d1d1d' },
      '4': { background: '#ff887c', foreground: '#1d1d1d' },
      '5': { background: '#fbd75b', foreground: '#1d1d1d' },
      '6': { background: '#ffb878', foreground: '#1d1d1d' },
      '7': { background: '#46d6db', foreground: '#1d1d1d' },
      '8': { background: '#e1e1e1', foreground: '#1d1d1d' },
      '9': { background: '#5484ed', foreground: '#1d1d1d' },
      '10': { background: '#51b749', foreground: '#1d1d1d' },
      '11': { background: '#dc2127', foreground: '#1d1d1d' },
      '12': { background: '#dd7e6b', foreground: '#1d1d1d' },
    };
  }

  async getCalendars(): Promise<GoogleCalendar[]> {
    // TODO: Implement
    return [];
  }

  async getEvents(start: Date, end: Date, calendarId: string): Promise<GoogleCalendarEvent[]> {
    // TODO: Implement
    return [];
  }

  async getEventsOLD(start: Date, end: Date): Promise<GoogleCalendarEvent[]> {
    const results: GoogleCalendarEvent[] = [
      {
        id: '1',
        summary: 'Birthday Event',
        description: 'This is a test event',
        start: { date: '2024-02-18' },
        end: { date: '2024-02-19' },
      } as GoogleCalendarEvent,
      {
        id: '2',
        summary: 'Across Months',
        description: 'This is another test event',
        start: { date: '2024-05-20' },
        end: { date: '2024-06-10' },
      } as GoogleCalendarEvent,
      {
        id: '3',
        summary: 'Next Year',
        description: 'This is another test event',
        start: { date: '2025-02-17' },
        end: { date: '2025-02-19' },
      } as GoogleCalendarEvent,
      {
        id: '4',
        summary: 'Across years',
        description: 'This is another test event',
        start: { date: '2024-12-17' },
        end: { date: '2025-01-19' },
      } as GoogleCalendarEvent,
      {
        id: '5',
        summary: 'End-Start months',
        description: 'This is another test event',
        start: { date: '2024-09-30' },
        end: { date: '2024-10-02' },
      } as GoogleCalendarEvent,
    ];

    return results.filter((event) => {
      return (
        new Date(event.start.date).getFullYear() === start.getFullYear() ||
        new Date(event.end.date).getFullYear() === end.getFullYear()
      );
    });
  }

  async createEvent(event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> {
    return event;
  }

  async createEvents(events: GoogleCalendarEvent[]): Promise<void> {
    for (const event of events) {
      await this.createEvent(event);
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    return;
  }

  async deleteEvents(eventIds: string[]): Promise<void> {
    for (const eventId of eventIds) {
      await this.deleteEvent(eventId);
    }
  }
}
