import { Moment } from 'moment';
import { GoogleCalendarEventPerson } from '../services/google/calendar.service';

// Events displayed in the UI
export interface Event {
  id: string;
  title: string;
  description?: string;
  colour: string;
  eventType: 'birthday' | 'default' | 'focusTime' | 'fromGmail' | 'outOfOffice' | 'workingLocation';
  creator: GoogleCalendarEventPerson;

  startMoment: Moment;
  endMoment: Moment;

  calendarId: string;

  isFirstDay: boolean;
  isLastDay: boolean;
  duration: number;
}
