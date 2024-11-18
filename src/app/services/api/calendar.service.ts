import { Injectable, Injector } from '@angular/core';
import {
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarService,
} from '../google/calendar.service';
import { MockCalendarService } from '../mock/calendar.service';
import { Event } from '../../interfaces/event.interface';
import { UtilService } from '../util.service';
import { UserService } from './user.service';

@Injectable()
export class CalendarService {
  constructor(
    private injector: Injector,
    private utilService: UtilService,
    private userService: UserService
  ) {
    this.calendarAPIService = utilService.mockData
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

    this.calendars.sort((a, b) => this.getCalendarName(a).localeCompare(this.getCalendarName(b)));

    return this.calendars;
  }

  async getEvents(start: Date, end: Date, calendarId: string): Promise<GoogleCalendarEvent[]> {
    return this.calendarAPIService.getEvents(start, end, calendarId);
  }

  async deleteEvents(events: Event[]) {
    return this.calendarAPIService.deleteEvents(events);
  }

  async createEvent(event: Event): Promise<Event> {
    const gcalEvent = await this.calendarAPIService.createEvent(event);
    return this.utilService.googleEventToEvent(gcalEvent, event.colour, event.calendarId);
  }

  async updateEvent(event: Event): Promise<void> {
    await this.calendarAPIService.updateEvent(event);
  }

  async updateEvents(events: Event[]) {
    return this.calendarAPIService.updateEvents(events);
  }

  async moveEvent(event: Event, originalCalendarId: string) {
    return this.calendarAPIService.moveEvent(event, originalCalendarId);
  }

  // Util
  getCalendarName(calendar: GoogleCalendar) {
    const calendarName = calendar.summaryOverride || calendar.summary;
    return calendarName == this.userService.emailAddress ? '⭐ Events' : calendarName;
  }
}
