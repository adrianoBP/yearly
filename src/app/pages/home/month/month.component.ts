import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Day, WeekDay, Month } from '../../../interfaces/month.interface';
import { DayComponent } from './day/day.component';
import moment from 'moment';
import { Event, EventExtended } from '../../../interfaces/event.interface';

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
    events: EventExtended[];
    mouseEvent: MouseEvent;
  }>();

  weekDays: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // events dictionary
  eventsByDay: { [key: number]: EventExtended[] } = {};

  ngOnChanges(): void {
    this.eventsByDay = {} as { [key: number]: EventExtended[] };

    for (let event of this.events) {
      const eventStartDateTime = moment(event.start);
      const eventEndDateTime = moment(event.end);

      let startDay = eventStartDateTime.date();
      let endDay = eventEndDateTime.date();

      let eventActualEndDate = eventEndDateTime.date();

      // If the event ends at midnight, consider the previous day as the last day
      if (eventEndDateTime.hour() === 0 && eventEndDateTime.minute() === 0) {
        endDay -= 1;
        eventActualEndDate = eventEndDateTime.clone().subtract(1, 'day').date();
      }

      // if the event is in the previous month, set the starting day to 1
      if (this.month.name !== eventStartDateTime.format('MMMM')) startDay = 1;

      // if the event is in the next month, set the ending day to the last day of the month
      if (this.month.name !== eventEndDateTime.format('MMMM')) {
        endDay = this.month.days[this.month.days.length - 1].number;
      }

      for (let dayNumber = startDay; dayNumber <= endDay; dayNumber++) {
        // if the day is not in the dictionary, add it
        if (this.eventsByDay[dayNumber] == null) this.eventsByDay[dayNumber] = [];

        const momentDay = moment(new Date(`${this.year}-${this.month.number + 1}-${dayNumber}`));

        // add the event to the dictionary
        this.eventsByDay[dayNumber].push({
          ...event,
          isFirstDay: momentDay.isSame(eventStartDateTime, 'day'),
          isLastDay: momentDay.date() === eventActualEndDate, // TODO: Check what happens for events longer than 1 month
          duration: eventEndDateTime.diff(eventStartDateTime, 'days') + 1,
        } as EventExtended);
      }
    }
  }

  get fillerDays() {
    const firstDayOfMonth = this.month.days[0].weekDay;
    return new Array(this.weekDays.indexOf(firstDayOfMonth));
  }

  getDayEvents(day: Day): EventExtended[] {
    if (this.eventsByDay[day.number] == null) return [];
    return this.eventsByDay[day.number];
  }

  onDayClickEvent({ day, mouseEvent }: { day: Day; mouseEvent: MouseEvent }) {
    const date = new Date(`${this.year}-${this.month.number + 1}-${day.number}`);
    this.onDayClick.emit({
      date,
      events: this.eventsByDay[day.number],
      mouseEvent,
    });
  }
}
