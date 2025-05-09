import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Day, WeekDay, Month } from '../../../interfaces/month.interface';
import { DayComponent } from './day/day.component';
import moment from 'moment';
import { Event } from '../../../interfaces/event.interface';

@Component({
  selector: 'app-month',
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

  fillerDays: any[] = [];

  ngOnChanges(): void {
    // initialize the events dictionary
    this.eventsByDay = this.month.days.reduce((acc, day) => {
      acc[day.number] = [];
      return acc;
    }, {} as { [key: number]: Event[] });

    this.fillerDays = new Array(this.weekDays.indexOf(this.month.days[0].weekDay));

    for (let event of this.events) {
      const eventStartDateTime = event.startMoment;
      const eventEndDateTime = event.endMoment;

      // If the event is in the previous year, we always want the start of the month
      let startDay = event.startMoment.year() < this.year ? 0 : eventStartDateTime.date();
      // If the event is in the next year, we always want the end of the month
      let endDay =
        event.endMoment.year() > this.year
          ? this.month.days[this.month.days.length - 1].number
          : eventEndDateTime.date();

      // If the end date is next year, set it to the last day of the month
      if (eventEndDateTime.year() > this.year) {
        endDay = this.month.days[this.month.days.length - 1].number + 1;
      }

      let eventRealEndDate = eventEndDateTime.format('YYYY-MM-DD');

      // If the event ends at midnight, consider the previous day as the last day
      if (eventEndDateTime.hour() === 0 && eventEndDateTime.minute() === 0) {
        endDay -= 1;
        eventRealEndDate = eventEndDateTime.clone().subtract(1, 'day').format('YYYY-MM-DD');
      }

      // if the event is in the previous month, set the starting day to 1
      if (this.month.name !== eventStartDateTime.format('MMMM')) startDay = 1;

      // if the event is in the next month, set the ending day to the last day of the month
      if (this.month.name !== eventEndDateTime.format('MMMM')) {
        endDay = this.month.days[this.month.days.length - 1].number;
      }

      for (let dayNumber = startDay; dayNumber <= endDay; dayNumber++) {
        const momentDay = moment(
          `${this.year}-${this.month.number + 1}-${dayNumber}`,
          'YYYY-MM-DD'
        );

        // add the event to the dictionary
        this.eventsByDay[dayNumber].push({
          ...event,
          isFirstDay: momentDay.isSame(eventStartDateTime, 'day'),
          isLastDay: momentDay.format('YYYY-MM-DD') === eventRealEndDate,
          duration: eventEndDateTime.diff(eventStartDateTime, 'days') + 1,
          isGroupCalendar: event.organizer?.email.endsWith('@group.calendar.google.com') || false,
        } as Event);
      }
    }
  }

  onDayClickEvent({ day, mouseEvent }: { day: Day; mouseEvent: MouseEvent }) {
    const date = moment()
      .set('year', this.year)
      .set('month', this.month.number)
      .set('date', day.number)
      .toDate();

    this.onDayClick.emit({
      date,
      events: this.eventsByDay[day.number],
      mouseEvent,
    });
  }
}
