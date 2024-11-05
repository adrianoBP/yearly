import { Moment } from 'moment';

// Events displayed in the UI
export interface Event {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  colour: string;

  startUTC: Moment;
  endUTC: Moment;

  calendarId: string;

  isFirstDay: boolean;
  isLastDay: boolean;
  duration: number;
}
