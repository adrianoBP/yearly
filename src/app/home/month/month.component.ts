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
  @Output() onDayClick = new EventEmitter<{
    date: Date;
    events: Event[];
    mouseEvent: MouseEvent;
  }>();

  weekDays: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // events dictionary
  eventsByDay: { [key: number]: Event[] } = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['events'] &&
      JSON.stringify(changes['events'].currentValue) ===
        JSON.stringify(changes['events'].previousValue)
    )
      return;

    this.eventsByDay = {} as { [key: number]: Event[] };

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
        this.eventsByDay[dayNumber].push(event);
      }
    }
  }

  get fillerDays() {
    const firstDayOfMonth = this.month.days[0].weekDay;
    return new Array(this.weekDays.indexOf(firstDayOfMonth));
  }

  getDayEvents(day: Day): EventDay[] {
    if (this.eventsByDay[day.number] == null) return [];

    const momentDay = moment(
      new Date(`${this.year}-${this.month.number + 1}-${day.number}`)
    );
    return this.eventsByDay[day.number].map((event) => {
      return {
        isFirstDay: momentDay.isSame(event.start, 'day'),
        isLastDay: momentDay.isSame(event.end, 'day'),
        colour: event.colour,
      } as EventDay;
    });
  }

  onDayClickEvent({ day, mouseEvent }: { day: Day; mouseEvent: MouseEvent }) {
    const date = new Date(
      `${this.year}-${this.month.number + 1}-${day.number}`
    );
    this.onDayClick.emit({
      date,
      events: this.eventsByDay[day.number],
      mouseEvent,
    });
  }
}
