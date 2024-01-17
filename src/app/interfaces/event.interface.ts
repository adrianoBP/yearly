export interface Event {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  colour: string;
  colorId: string;
}

export interface EventDay {
  isFirstDay: boolean;
  isLastDay: boolean;
  colour: string;
}
