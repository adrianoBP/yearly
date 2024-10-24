import { Injectable, Injector } from '@angular/core';
import {
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarService,
} from './google/calendar.service';
import { MockCalendarService } from './mock/calendar.service';
import { mockData } from '../app.config';

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

  async getEvents(
    start: Date,
    end: Date,
    calendarId: string
  ): Promise<GoogleCalendarEvent[]> {
    return this.calendarAPIService.getEvents(start, end, calendarId);
  }

  // LEGACY CODE
  async getColors() {
    return this.calendarAPIService.getColors();
  }

  async getEventsOLD(start: Date, end: Date): Promise<GoogleCalendarEvent[]> {
    return this.calendarAPIService.getEventsOLD(start, end);
  }

  async createEvents(events: GoogleCalendarEvent[]) {
    return this.calendarAPIService.createEvents(events);
  }

  async deleteEvents(eventIds: string[]): Promise<void> {
    return this.calendarAPIService.deleteEvents(eventIds);
  }
}
