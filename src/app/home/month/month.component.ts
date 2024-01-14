import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Day, WeekDay, Month } from '../../interfaces/month.interface';
import { DayComponent } from './day/day.component';
import moment from 'moment';
import { Event, EventDay } from '../../interfaces/event.interface';

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [CommonModule, DayComponent],
  templateUrl: './month.component.html',
  styleUrl: './month.component.css',
})
export class MonthComponent {
  @Input() month!: Month;
  @Input() events!: Event[];
  @Input() canCreateNewEvent!: boolean;
  @Input() year!: number;
  @Output() onDayClick = new EventEmitter<Date>();

  weekDays: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // events dictionary
  eventsByDay: { [key: number]: EventDay[] } = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['events'] &&
      JSON.stringify(changes['events'].currentValue) ===
        JSON.stringify(changes['events'].previousValue)
    )
      return;

    this.eventsByDay = {} as { [key: number]: EventDay[] };

    for (let event of this.events) {
      const eventDaysCount = moment(event.end).diff(event.start, 'days') + 1;

      for (let i = 0; i < eventDaysCount; i++) {
        const day = moment(event.start).add(i, 'day');
        // if the day is not in the month, skip it
        if (this.month.name !== day.format('MMMM')) continue;

        const dayNumber = day.date();

        // if the day is not in the dictionary, add it
        if (this.eventsByDay[dayNumber] == null)
          this.eventsByDay[dayNumber] = [];

        // add the event to the dictionary
        this.eventsByDay[dayNumber].push({
          isFirstDay: day.isSame(event.start, 'day'),
          isLastDay: day.isSame(event.end, 'day'),
          colour: event.colour,
        });
      }
    }
  }

  get fillerDays() {
    const firstDayOfMonth = this.month.days[0].weekDay;
    return new Array(this.weekDays.indexOf(firstDayOfMonth));
  }

  onDayClickEvent(day: Day) {
    const date = new Date(
      `${this.year}-${this.month.number + 1}-${day.number}`
    );
    this.onDayClick.emit(date);
  }
}
