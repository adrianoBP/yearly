import { Injectable } from '@angular/core';
import {
  GoogleCalendar,
  GoogleCalendarColor,
  GoogleCalendarEvent,
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
    return (
      JSON.parse(
        '{"kind":"calendar#calendarList","etag":"\\"p32od1tujvij8i0o\\"","nextSyncToken":"CLDQ99P8pokDEhphZHJpYW5vLmJvY2NhcmRvQGdtYWlsLmNvbQ==","items":[{"kind":"calendar#calendarListEntry","etag":"\\"1728555515024000\\"","id":"50rlvqt7hj6k84ojaj8rjdi61q30mfif@import.calendar.google.com","summary":"Who\'s Out","timeZone":"UTC","summaryOverride":"Who\'s Out","colorId":"10","backgroundColor":"#b3dc6c","foregroundColor":"#000000","accessRole":"reader","defaultReminders":[],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1728558390756000\\"","id":"adriano.boccardo@gmail.com","summary":"adriano.boccardo@gmail.com","timeZone":"Europe/London","colorId":"21","backgroundColor":"#cca6ac","foregroundColor":"#000000","selected":true,"accessRole":"owner","defaultReminders":[{"method":"popup","minutes":15}],"notificationSettings":{"notifications":[{"type":"eventCreation","method":"email"},{"type":"eventChange","method":"email"},{"type":"eventCancellation","method":"email"},{"type":"eventResponse","method":"email"}]},"primary":true,"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1728558393535000\\"","id":"t81tm4j8ck2efqcaujpkhh1uo7pvj92q@import.calendar.google.com","summary":"https://f1calendar.com/download/f1-calendar_p1_p2_p3_q_gp_alarm-30.ics?t=1614678901130","timeZone":"UTC","summaryOverride":"Formula 1","colorId":"7","backgroundColor":"#42d692","foregroundColor":"#000000","selected":true,"accessRole":"reader","defaultReminders":[{"method":"popup","minutes":10},{"method":"popup","minutes":30}],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1728558394295000\\"","id":"en.uk#holiday@group.v.calendar.google.com","summary":"Holidays in United Kingdom","description":"Holidays and Observances in United Kingdom","timeZone":"Europe/London","summaryOverride":"Holidays in United Kingdom","colorId":"8","backgroundColor":"#16a765","foregroundColor":"#000000","selected":true,"accessRole":"reader","defaultReminders":[],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1729676259358000\\"","id":"3e14884682fe18d2c0e0d3e041180fea7f8f2d07e5da94928a64512f3a8105d8@group.calendar.google.com","summary":"Bebas","timeZone":"Europe/London","colorId":"6","backgroundColor":"#ffad46","foregroundColor":"#000000","selected":true,"accessRole":"owner","defaultReminders":[{"method":"popup","minutes":10}],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1729678531020000\\"","id":"adriano.pochettino@linnworks.com","summary":"adriano.pochettino@linnworks.com","timeZone":"Europe/London","summaryOverride":"Linnworks","colorId":"16","backgroundColor":"#4986e7","foregroundColor":"#000000","selected":true,"accessRole":"freeBusyReader","defaultReminders":[],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1729678662756000\\"","id":"4d1b7dfc474eb4a3c926b2a202519f3d530f5f95894528233c35119a22d24a3d@group.calendar.google.com","summary":"Travels","timeZone":"Europe/London","colorId":"14","backgroundColor":"#9fe1e7","foregroundColor":"#000000","selected":true,"accessRole":"owner","defaultReminders":[],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1729678716855000\\"","id":"28d89284a82edca9923d22e1327138e151fed33579320b3e240aaaa4034848ed@group.calendar.google.com","summary":"Dancing","timeZone":"Europe/London","colorId":"4","backgroundColor":"#fa573c","foregroundColor":"#000000","selected":true,"accessRole":"owner","defaultReminders":[],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}},{"kind":"calendar#calendarListEntry","etag":"\\"1729679043075000\\"","id":"en.christian#holiday@group.v.calendar.google.com","summary":"Christian Holidays","description":"Christian Holidays","timeZone":"Europe/London","summaryOverride":"Christian Holidays","colorId":"8","backgroundColor":"#16a765","foregroundColor":"#000000","accessRole":"reader","defaultReminders":[],"conferenceProperties":{"allowedConferenceSolutionTypes":["hangoutsMeet"]}}]}'
      ) as GoogleCalendarListResponse
    ).items;
  }

  async getEvents(start: Date, end: Date): Promise<GoogleCalendarEvent[]> {
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
