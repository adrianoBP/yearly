import { Injectable, Injector } from '@angular/core';
import {
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarService,
} from './google/calendar.service';
import { MockCalendarService } from './mock/calendar.service';
import { mockData } from '../app.config';
import { Event } from '../interfaces/event.interface';
import { UtilService } from './util.service';

@Injectable()
export class CalendarService {
  constructor(private injector: Injector, private utilService: UtilService) {
    this.calendarAPIService = mockData
      ? this.injector.get(MockCalendarService)
      : this.injector.get(GoogleCalendarService);
  }

  private calendars: GoogleCalendar[] = [];
  private calendarAPIService: GoogleCalendarService | MockCalendarService;

  public isAddingEvent = false;

  async getCalendars() {
    if (this.calendars.length == 0) {
      const calendars = await this.calendarAPIService.getCalendars();
      this.calendars = calendars;
    }

    // return sorted by summary
    this.calendars.sort((a, b) =>
      this.utilService.getCalendarName(a).localeCompare(this.utilService.getCalendarName(b))
    );

    return this.calendars;
  }

  async getEvents(start: Date, end: Date, calendarId: string): Promise<GoogleCalendarEvent[]> {
    return this.calendarAPIService.getEvents(start, end, calendarId);
  }

  async deleteEvents(events: Event[]) {
    return this.calendarAPIService.deleteEvents(events);
  }
}
