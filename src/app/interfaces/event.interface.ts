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
  organizer: GoogleCalendarEventPerson;

  startMoment: Moment;
  endMoment: Moment;

  calendarId: string;

  // Custom properties
  isFirstDay: boolean;
  isLastDay: boolean;
  duration: number;
  isGroupCalendar: boolean;
}

export interface EventDisplayDetails extends Event {
  isAllDay: boolean;
  startsBefore: boolean;
  endsAfter: boolean;

  canEdit: boolean;
}
