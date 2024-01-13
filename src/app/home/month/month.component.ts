import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Day, WeekDay, Month } from '../../interfaces/month.interface';
import { DayComponent } from './day/day.component';
import moment from 'moment';
import { EventDay } from '../../interfaces/event.interface';

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [CommonModule, DayComponent],
  templateUrl: './month.component.html',
  styleUrl: './month.component.css',
})
export class MonthComponent {
  @Input() month!: Month;

  weekDays: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // events dictionary
  events: { [key: number]: EventDay[] } = {};

  constructor() {}

  ngOnInit(): void {
    if (this.month.events == null) return;
    for (let event of this.month.events) {
      for (
        let day = moment(event.start);
        day.isSameOrBefore(event.end);
        day.add(1, 'day')
      ) {
        // if the day is not in the month, skip it
        if (this.month.name !== day.format('MMMM')) continue;

        const dayNumber = day.date();

        // if the day is not in the dictionary, add it
        if (this.events[dayNumber] == null) this.events[dayNumber] = [];

        // add the event to the dictionary
        this.events[dayNumber].push({
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
}
