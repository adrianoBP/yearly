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

  async getSettings() {
    return this.calendarAPIService.getSettings();
  }

  private eventColours: Promise<Record<string, string>> | null = null;

  /** Cached; on failure events fall back to their calendar colour and the next call retries */
  getEventColours(): Promise<Record<string, string>> {
    this.eventColours ??= this.calendarAPIService.getEventColours().catch((e) => {
      console.warn('Could not load event colours', e);
      this.eventColours = null;
      return {};
    });
    return this.eventColours;
  }

  /** The service worker's copies from the last visit, shown while Google answers: null (or []) when there are none */
  private get cache(): GoogleCalendarService | null {
    return this.calendarAPIService instanceof GoogleCalendarService ? this.calendarAPIService : null;
  }

  async getCachedCalendars(): Promise<GoogleCalendar[] | null> {
    const calendars = await this.cache?.getCalendars(true).catch(() => null);
    return calendars?.sort((a, b) => this.getCalendarName(a).localeCompare(this.getCalendarName(b))) ?? null;
  }

  async getCachedEvents(start: Date, end: Date, calendarId: string): Promise<GoogleCalendarEvent[]> {
    return (await this.cache?.getEvents(start, end, calendarId, true).catch(() => null)) ?? [];
  }

  async getCachedEventColours(): Promise<Record<string, string>> {
    return (await this.cache?.getEventColours(true).catch(() => null)) ?? {};
  }

  async getCalendars(): Promise<GoogleCalendar[]> {
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

  async deleteEvents(events: Event[]): Promise<void> {
    return this.calendarAPIService.deleteEvents(events);
  }

  async createEvent(event: Event): Promise<Event> {
    const gcalEvent = await this.calendarAPIService.createEvent(event);
    const defaults = this.calendars.find((c) => c.id === event.calendarId)?.defaultReminders;
    return this.utilService.googleEventToEvent(gcalEvent, event.colour, event.calendarId, defaults);
  }

  async updateEvent(event: Event): Promise<void> {
    await this.calendarAPIService.updateEvent(event);
  }

  async updateEvents(events: Event[]): Promise<void> {
    return this.calendarAPIService.updateEvents(events);
  }

  async moveEvent(event: Event, originalCalendarId: string): Promise<GoogleCalendarEvent | void> {
    return this.calendarAPIService.moveEvent(event, originalCalendarId);
  }

  // Util
  getCalendarName(calendar: GoogleCalendar): string {
    const calendarName = calendar.summaryOverride || calendar.summary;
    return calendarName == this.userService.emailAddress ? '⭐ Events' : calendarName;
  }
}
