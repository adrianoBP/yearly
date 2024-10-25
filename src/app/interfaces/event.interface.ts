import { Moment } from 'moment';

export interface Event {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  colour: string;
  colorId: string;

  startUTC: Moment;
  endUTC: Moment;
}

export interface EventExtended extends Event {
  calendarId: string;
}

export interface CalendarEvent extends EventExtended {
  isFirstDay: boolean;
  isLastDay: boolean;
  duration: number;
}
