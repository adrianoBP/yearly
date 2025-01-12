import { Inject, Injectable } from '@angular/core';
import moment from 'moment-timezone';
import { GoogleCalendar } from './google/calendar.service';
import { GoogleCalendarEvent } from './google/calendar.service';
import { Event } from '../interfaces/event.interface';

@Injectable()
export class UtilService {
  private _version: string;
  private _mockData: boolean;
  private _googleClientId: string;
  private _googleLoginScopes: string;

  constructor(
    @Inject('version') version: string,
    @Inject('mockData') mockData: boolean,
    @Inject('googleClientId') googleClientId: string,
    @Inject('googleLoginScopes') googleLoginScopes: string
  ) {
    this._version = version;
    this._mockData = mockData;
    this._googleClientId = googleClientId;
    this._googleLoginScopes = googleLoginScopes;
  }

  get version() {
    return this._version;
  }

  get mockData() {
    return this._mockData;
  }

  get googleClientId() {
    return this._googleClientId;
  }

  get googleLoginScopes() {
    return this._googleLoginScopes;
  }

  getFormattedDate(date: Date, format: string = 'ddd, Do MMMM YYYY'): string {
    return moment(date).format(format); // Format: 'Mon, 1 January 2021'
  }

  googleEventToEvent(
    event: GoogleCalendarEvent,
    backgroundColor: string,
    calendarId: string
  ): Event {
    let startMoment = moment.utc(event.start.date ?? event.start.dateTime);
    let endMoment = moment.utc(event.end.date ?? event.end.dateTime);

    if (event.start.timeZone) startMoment = startMoment.tz(event.start.timeZone);

    if (event.end.timeZone) endMoment = endMoment.tz(event.end.timeZone);

    return {
      id: event.id,
      title: event.summary,
      description: event.description,
      colour: backgroundColor,
      eventType: event.eventType,
      creator: event.creator,
      organizer: event.organizer,
      htmlLink: event.htmlLink,

      calendarId: calendarId,

      startMoment,
      endMoment,
    } as Event;
  }

  getCalendarColour(calendarId: string, calendars: GoogleCalendar[]): string {
    const calendar = calendars.find((c) => c.id === calendarId);
    return calendar ? calendar.backgroundColor : '';
  }
}
