import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Day, Month } from '../../../interfaces/month.interface';
import { DayComponent } from './day/day.component';
import { Event } from '../../../interfaces/event.interface';

export interface DayHover {
  day: Day;
  events: Event[];
  element: HTMLElement;
}

@Component({
  selector: 'app-month',
  imports: [DayComponent],
  templateUrl: './month.component.html',
  styleUrl: './month.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthComponent {
  @Input({ required: true }) month!: Month;
  @Input({ required: true }) eventsByDay!: Map<string, Event[]>;
  @Input() isAddingEvent = false;
  @Output() dayClick = new EventEmitter<{
    date: Date;
    events: Event[];
    mouseEvent: MouseEvent;
  }>();
  @Output() dayHover = new EventEmitter<DayHover | null>();

  readonly weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly noEvents: Event[] = [];

  onDayClick({ day, mouseEvent }: { day: Day; mouseEvent: MouseEvent }) {
    // Keep the current time of day: single-day new events start now
    const now = new Date();
    const date = new Date(day.date);
    date.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    this.dayClick.emit({ date, events: this.eventsByDay.get(day.key) ?? [], mouseEvent });
  }
}
