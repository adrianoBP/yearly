import { Inject, Injectable } from '@angular/core';
import moment from 'moment';
import { GoogleCalendar } from './google/calendar.service';
import { GoogleCalendarEvent } from './google/calendar.service';
import { Event } from '../interfaces/event.interface';

@Injectable()
export class UtilService {
  private _version: string;
  private _mockData: boolean;

  constructor(@Inject('version') version: string, @Inject('mockData') mockData: boolean) {
    this._version = version;
    this._mockData = mockData;
  }

  get version() {
    return this._version;
  }

  get mockData() {
    return this._mockData;
  }

  isMobile(): boolean {
    return window.innerWidth < 768;
  }

  getFormattedDate(date: Date, format: string = 'ddd, Do MMMM YYYY'): string {
    return moment(date).format(format); // Format: 'Mon, 1 January 2021'
  }

  getCalendarName(calendar: GoogleCalendar) {
    return calendar.summaryOverride || calendar.summary;
  }

  googleEventToEvent(
    event: GoogleCalendarEvent,
    backgroundColor: string,
    calendarId: string
  ): Event {
    return {
      id: event.id,
      title: event.summary,
      description: event.description,
      start: moment(event.start.date ?? event.start.dateTime).toDate(),
      end: moment(event.end.date ?? event.end.dateTime).toDate(),
      colour: backgroundColor,

      calendarId: calendarId,

      startMoment: moment(event.start.date ?? event.start.dateTime),
      endMoment: moment(event.end.date ?? event.end.dateTime),
    } as Event;
  }
}
