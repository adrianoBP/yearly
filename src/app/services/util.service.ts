import { Inject, Injectable } from '@angular/core';
import moment from 'moment';
import { GoogleCalendar } from './google/calendar.service';
import { GoogleCalendarEvent } from './google/calendar.service';
import { Event } from '../interfaces/event.interface';

@Injectable()
export class UtilService {
  private _version: string;
  private _mockData: boolean;
  private _googleClientId: string;
  private _googleLoginScopes: string;
  private _serverUrl: string;

  constructor(
    @Inject('version') version: string,
    @Inject('mockData') mockData: boolean,
    @Inject('googleClientId') googleClientId: string,
    @Inject('googleLoginScopes') googleLoginScopes: string,
    @Inject('serverUrl') serverUrl: string
  ) {
    this._serverUrl = serverUrl.replace(/\/$/, '');
    // The docs' example address left in place would send requests nowhere: treat it as not set up
    if (/example\.com|your-domain/.test(this._serverUrl)) {
      console.warn(`serverUrl is still the example (${serverUrl}): set it to https://api.<your app's domain>`);
      this._serverUrl = '';
    }
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

  /** Yearly pass-through server (server/yearly-server.mjs), without a trailing slash; empty when not set up */
  get serverUrl() {
    return this._serverUrl;
  }

  getFormattedDate(date: Date, format: string = 'ddd, Do MMMM YYYY'): string {
    return moment(date).format(format); // Format: 'Mon, 1 January 2021'
  }

  googleEventToEvent(
    event: GoogleCalendarEvent,
    backgroundColor: string,
    calendarId: string
  ): Event {
    // dateTime carries its UTC offset, so moment parses it straight into local time
    const startMoment = moment(event.start.date ?? event.start.dateTime);
    const endMoment = moment(event.end.date ?? event.end.dateTime);

    return {
      id: event.id,
      title: event.summary,
      description: event.description,
      location: event.location,
      colour: backgroundColor,
      eventType: event.eventType,
      colorId: event.colorId,
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

/** Only the user's own normal events, or events on shared group calendars, can be changed */
export const canEditEvent = (event: Event, email: string) =>
  event.eventType === 'default' && (event.creator?.email === email || event.isGroupCalendar);
