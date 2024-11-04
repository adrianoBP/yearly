import { Injectable, Injector } from '@angular/core';
import {
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarService,
} from './google/calendar.service';
import { MockCalendarService } from './mock/calendar.service';
import { mockData } from '../app.config';
import { Event } from '../interfaces/event.interface';

@Injectable()
export class CalendarService {
  constructor(private injector: Injector) {
    this.calendarAPIService = mockData
      ? this.injector.get(MockCalendarService)
      : this.injector.get(GoogleCalendarService);
  }

  private calendars: GoogleCalendar[] = [];
  private calendarAPIService: GoogleCalendarService | MockCalendarService;

  async getCalendars() {
    if (this.calendars.length == 0) {
      const calendars = await this.calendarAPIService.getCalendars();
      this.calendars = calendars;
    }
    return this.calendars;
  }

  async getEvents(start: Date, end: Date, calendarId: string): Promise<GoogleCalendarEvent[]> {
    return this.calendarAPIService.getEvents(start, end, calendarId);
  }

  async deleteEvents(events: Event[]) {
    return this.calendarAPIService.deleteEvents(events);
  }
}
