import { Component } from '@angular/core';
import { Day, Month, WeekDay } from '../interfaces/month.interface';
import { CommonModule } from '@angular/common';
import { MonthComponent } from './month/month.component';
import { GoogleAuthService } from '../services/google/auth.service';
import {
  GoogleCalendarColor,
  GoogleCalendarService,
} from '../services/google/calendar.service';
import { Event } from '../interfaces/event.interface';
import moment, { Moment } from 'moment';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MonthComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  months: Month[] = [];
  months$ = new BehaviorSubject<Month[]>([]);

  colors: { [key: string]: GoogleCalendarColor } = {};
  events: Event[] = [];

  constructor(
    public googleAuthService: GoogleAuthService,
    private googleCalendarService: GoogleCalendarService
  ) {}

  ngOnInit(): void {
    Promise.all([this.loadEvents(), this.loadColors()]);

    const date = new Date(`${new Date().getFullYear()}-01-01`);

    while (date.getFullYear() === new Date().getFullYear()) {
      const monthName = this.getMonthName(date);
      const monthNumber = date.getMonth();

      const days: Day[] = [];

      do {
        days.push({
          number: date.getDate(),
          weekDay: date.toLocaleString('default', {
            weekday: 'short',
          }) as WeekDay,
        });
        date.setDate(date.getDate() + 1);
      } while (monthName === this.getMonthName(date));
      this.months.push({ name: monthName, number: monthNumber, days } as Month);
    }

    this.months$.next(this.months);
  }

  getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long' });
  }

  addMonthsEvents() {
    for (let month of this.months) {
      month.events = this.events.filter(
        (event) =>
          month.number >= event.start.getMonth() &&
          month.number <= event.end.getMonth()
      );
    }
    console.log(this.events);
  }

  async loadEvents() {
    const start = new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`);
    const end = new Date(`${new Date().getFullYear()}-12-31T23:59:59Z`);

    const result = await this.googleCalendarService.getEvents(start, end);
    this.events = [];
    this.events = result.map((event) => {
      return {
        title: event.summary,
        description: event.description,
        start: new Date(event.start.date),
        end: moment(event.end.date).add(-1, 'day').toDate(), // Remove 1 day as Google Calendar API returns the next day at midnight
        colour: '#ff0000',
      } as Event;
    });
    this.events = [...this.events];
    this.addMonthsEvents();
  }

  async loadColors() {
    this.colors = await this.googleCalendarService.getColors();
  }

  async test() {}

  getMonthEvents(month: Month) {
    return this.events.filter(
      (event) =>
        month.number >= event.start.getMonth() &&
        month.number <= event.end.getMonth()
    );
  }
}
