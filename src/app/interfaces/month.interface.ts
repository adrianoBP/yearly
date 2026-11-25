export interface Month {
  name: string;
  number: number;
  isCurrent: boolean;
  days: Day[];
}

export interface Day {
  /** YYYY-MM-DD, for dragging across days */
  iso: string;
  number: number;
  /** 0 = Monday ... 6 = Sunday */
  weekDay: number;
  date: Date;
  /** Key into the events-by-day map, see dayKey() */
  key: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
}
