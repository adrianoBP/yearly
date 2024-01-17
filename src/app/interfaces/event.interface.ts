export interface Event {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  colour: string;
}

export interface EventDay {
  isFirstDay: boolean;
  isLastDay: boolean;
  colour: string;
}
