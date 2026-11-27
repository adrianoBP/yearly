import { Moment } from 'moment';
import { GoogleCalendarEventPerson, GoogleReminder } from '../services/google/calendar.service';

// Events displayed in the UI
export interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  colour: string;
  /** Google colour id when the event has its own colour; colour is then that, not the calendar colour */
  colorId?: string;
  eventType: 'birthday' | 'default' | 'focusTime' | 'fromGmail' | 'outOfOffice' | 'workingLocation';
  creator: GoogleCalendarEventPerson;
  organizer: GoogleCalendarEventPerson;
  htmlLink: string;

  startMoment: Moment;
  endMoment: Moment;

  calendarId: string;
  /** Minutes before the start of each of the event's own (or its calendar's default) popup reminders */
  reminders?: number[];
  /** Google's own reminders field, sent back on save so untouched events keep following their calendar's defaults */
  googleReminders?: { useDefault: boolean; overrides?: GoogleReminder[] };

  // Custom properties
  isFirstDay: boolean;
  isLastDay: boolean;
  duration: number;
  isGroupCalendar: boolean;
  /** Row the event is drawn in, constant across its days */
  lane: number;
}

export interface EventDisplayDetails extends Event {
  isAllDay: boolean;
  startsBefore: boolean;
  endsAfter: boolean;

  canEdit: boolean;
}
