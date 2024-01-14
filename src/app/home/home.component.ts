import { Component } from '@angular/core';
import { Day, Month, WeekDay } from '../interfaces/month.interface';
import { CommonModule, KeyValue } from '@angular/common';
import { MonthComponent } from './month/month.component';
import { GoogleAuthService } from '../services/google/auth.service';
import {
  GoogleCalendarColor,
  GoogleCalendarService,
} from '../services/google/calendar.service';
import { Event } from '../interfaces/event.interface';
import moment from 'moment';
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
  // FontAwesome icons
  banIcon = faBan;

  year: number = new Date().getFullYear();
  // months: Month[] = [];
  months: { [key: string]: Month } = {};

  colors: { [key: string]: GoogleCalendarColor } = {};
  events: Event[] = [];

  eventStart: Date | undefined;
  eventEnd: Date | undefined;
  newEvents: Event[] = [];

  selectedColorId: string | undefined;

  constructor(
    public googleAuthService: GoogleAuthService,
    private googleCalendarService: GoogleCalendarService
  ) {
    const date = new Date(`${this.year}-01-01`);

    while (date.getFullYear() === this.year) {
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

      this.months[monthName] = {
        name: monthName,
        number: monthNumber,
        days,
      } as Month;
    }
  }

  ngOnInit(): void {
    Promise.all([this.loadEvents(), this.loadColors()]);
  }

  getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long' });
  }

  addMonthsEvents() {
    for (let month in this.months) {
      this.months[month].events = this.events.filter(
        (event) =>
          this.months[month].number >= event.start.getMonth() &&
          this.months[month].number <= event.end.getMonth()
      );
    }
  }

  async loadEvents() {
    this.events = [
      {
        title: 'Test',
        description: '🗃️',
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-12-31T23:59:59Z'),
        colour: '#ff0000',
      } as Event,
      {
        title: 'Test',
        description: '🗃️',
        start: new Date('2024-01-02T00:00:00Z'),
        end: new Date('2024-12-30T23:59:59Z'),
        colour: '#00ff00',
      } as Event,
      {
        title: 'Test',
        description: '🗃️',
        start: new Date('2024-01-03T00:00:00Z'),
        end: new Date('2024-12-29T23:59:59Z'),
        colour: '#00ff00',
      } as Event,
    ];
    this.addMonthsEvents();
    return; // TODO: remove once complete

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
    this.colors = {
      '1': { background: '#a4bdfc', foreground: '#1d1d1d' },
      '2': { background: '#7ae7bf', foreground: '#1d1d1d' },
      '3': { background: '#dbadff', foreground: '#1d1d1d' },
      '4': { background: '#ff887c', foreground: '#1d1d1d' },
      '5': { background: '#fbd75b', foreground: '#1d1d1d' },
      '6': { background: '#ffb878', foreground: '#1d1d1d' },
      '7': { background: '#46d6db', foreground: '#1d1d1d' },
      '8': { background: '#e1e1e1', foreground: '#1d1d1d' },
      '9': { background: '#5484ed', foreground: '#1d1d1d' },
      '10': { background: '#51b749', foreground: '#1d1d1d' },
      '11': { background: '#dc2127', foreground: '#1d1d1d' },
    };
    this.selectedColorId = '1';
    return; // TODO: remove once complete

    this.colors = await this.googleCalendarService.getColors();
  }

  getMonthEvents({ events, number }: Month) {
    return [
      ...(events ?? []),
      ...this.newEvents.filter(
        (event) =>
          number >= event.start.getMonth() && number <= event.end.getMonth()
      ),
    ];
  }

  selectColor(colorId: string) {
    this.selectedColorId = colorId;
  }

  get canCreateNewEvent() {
    return this.selectedColorId != null;
  }

  onDayClickEvent(date: Date) {
    console.log('calendar', date);

    if (this.eventStart == null) {
      this.eventStart = date;
      return;
    }

    if (this.eventEnd == null) {
      this.eventEnd = date;
      this.requestEventDetails();
    }
  }

  requestEventDetails() {
    console.log('requestEventDetails');

    // Invert dates if the start date is after the end date
    if (moment(this.eventStart).isAfter(moment(this.eventEnd))) {
      const temp = this.eventStart;
      this.eventStart = this.eventEnd;
      this.eventEnd = temp;
    }

    this.newEvents.push({
      title: 'Test',
      description: '🗃️',
      start: this.eventStart,
      end: this.eventEnd,
      colour: this.colors[this.selectedColorId!].background,
    } as Event);

    this.eventStart = undefined;
    this.eventEnd = undefined;
  }

  monthsOrder = (
    a: KeyValue<string, Month>,
    b: KeyValue<string, Month>
  ): number => {
    return a.value.number - b.value.number;
  };

  async test() {}
}
