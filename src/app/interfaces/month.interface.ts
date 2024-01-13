import { Event } from './event.interface';

export interface Month {
  name: string;
  days: Day[];
  events?: Event[];
}

export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Day {
  number: number;
  weekDay: WeekDay;
}
