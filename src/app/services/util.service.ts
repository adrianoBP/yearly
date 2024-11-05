import { Injectable } from '@angular/core';
import moment from 'moment';
import { GoogleCalendar } from './google/calendar.service';

@Injectable()
export class UtilService {
  constructor() {}

  getFormattedDate(date: Date, format: string = 'ddd, Do MMMM YYYY'): string {
    return moment(date).format(format); // Format: 'Mon, 1 January 2021'
  }

  getCalendarName(calendar: GoogleCalendar) {
    return calendar.summaryOverride || calendar.summary;
  }
}
