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
import moment from 'moment';
import { BehaviorSubject } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBan } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MonthComponent, FontAwesomeModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  months: Month[] = [];
  months$ = new BehaviorSubject<Month[]>([]);

  colors: { [key: string]: GoogleCalendarColor } = {};
  events: Event[] = [];

  selectedColorId: string | undefined;

  banIcon = faBan;

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
    // return; // TODO: remove once complete

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
    // this.colors = {
    //   '1': { background: '#a4bdfc', foreground: '#1d1d1d' },
    //   '2': { background: '#7ae7bf', foreground: '#1d1d1d' },
    //   '3': { background: '#dbadff', foreground: '#1d1d1d' },
    //   '4': { background: '#ff887c', foreground: '#1d1d1d' },
    //   '5': { background: '#fbd75b', foreground: '#1d1d1d' },
    //   '6': { background: '#ffb878', foreground: '#1d1d1d' },
    //   '7': { background: '#46d6db', foreground: '#1d1d1d' },
    //   '8': { background: '#e1e1e1', foreground: '#1d1d1d' },
    //   '9': { background: '#5484ed', foreground: '#1d1d1d' },
    //   '10': { background: '#51b749', foreground: '#1d1d1d' },
    //   '11': { background: '#dc2127', foreground: '#1d1d1d' },
    // };
    // return; // TODO: remove once complete

    this.colors = await this.googleCalendarService.getColors();
  }

  getMonthEvents(month: Month) {
    return this.events.filter(
      (event) =>
        month.number >= event.start.getMonth() &&
        month.number <= event.end.getMonth()
    );
  }

  selectColor(colorId: string) {
    this.selectedColorId = colorId;
  }

  get canCreateNewEvent() {
    return this.selectedColorId != null;
  }

  async test() {}
}
