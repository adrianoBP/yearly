import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Day, WeekDay, Month } from '../../../interfaces/month.interface';
import { DayComponent } from './day/day.component';
import moment from 'moment';
import {
  Event,
  CalendarEvent,
  EventExtended,
} from '../../../interfaces/event.interface';

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [CommonModule, DayComponent],
  templateUrl: './month.component.html',
  styleUrl: './month.component.css',
})
export class MonthComponent {
  @Input() month!: Month;
  @Input() events!: EventExtended[];
  @Input() canCreateNewEvent!: boolean;
  @Input() year!: number;
  @Output() onDayClick = new EventEmitter<{
    date: Date;
    events: Event[];
    mouseEvent: MouseEvent;
  }>();

  weekDays: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // events dictionary
  eventsByDay: { [key: number]: CalendarEvent[] } = {};

  ngOnChanges(changes: SimpleChanges): void {
    // if (
    //   this.events == null ||
    //   changes['events'] == null ||
    //   this.events.length === 0 ||
    //   (changes['events'] &&
    //     JSON.stringify(changes['events'].currentValue) ===
    //       JSON.stringify(changes['events'].previousValue))
    // )
    //   return;

    this.eventsByDay = {} as { [key: number]: CalendarEvent[] };

    for (let event of this.events) {
      if (event.title.includes('Spanish')) debugger;

      let startDay = moment(event.start).date();
      let endDay = moment(event.end).subtract(1, 'minutes').date();

      // if the event is in the previous month, set the starting day to 1
      if (this.month.name !== moment(event.start).format('MMMM')) startDay = 1;

      // if the event is in the next month, set the ending day to the last day of the month
      if (this.month.name !== moment(event.end).format('MMMM')) {
        endDay = this.month.days[this.month.days.length - 1].number;
      }

      for (let dayNumber = startDay; dayNumber <= endDay; dayNumber++) {
        // if the day is not in the dictionary, add it
        if (this.eventsByDay[dayNumber] == null)
          this.eventsByDay[dayNumber] = [];

        const momentDay = moment(
          new Date(`${this.year}-${this.month.number + 1}-${dayNumber}`)
        );

        // add the event to the dictionary
        this.eventsByDay[dayNumber].push({
          ...event,
          isFirstDay: momentDay.isSame(event.start, 'day'),
          isLastDay: momentDay.isSame(
            moment(event.end).subtract(1, 'minutes').toDate(), // Remove 1 minute to avoid the end date being considered as the next day
            'day'
          ),
          duration: moment(event.end).diff(event.start, 'days') + 1,
        } as CalendarEvent);
      }
    }
  }

  get fillerDays() {
    const firstDayOfMonth = this.month.days[0].weekDay;
    return new Array(this.weekDays.indexOf(firstDayOfMonth));
  }

  getDayEvents(day: Day): CalendarEvent[] {
    if (this.eventsByDay[day.number] == null) return [];
    return this.eventsByDay[day.number];
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
