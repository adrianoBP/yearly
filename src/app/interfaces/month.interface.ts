export interface Month {
  name: string;
  days: Day[];
}

export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Day {
  number: number;
  weekDay: WeekDay;
}
