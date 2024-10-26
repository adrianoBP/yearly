import { Moment } from 'moment';
import { EventExtended } from './event.interface';

export interface Month {
  name: string;
  number: number;
  days: Day[];
  events: EventExtended[];
  startUTC: Moment;
  endUTC: Moment;
}

export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Day {
  number: number;
  weekDay: WeekDay;
  date: Date;
}
