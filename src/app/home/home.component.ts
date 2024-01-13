import { Component } from '@angular/core';
import { Day, Month, WeekDay } from '../interfaces/month.interface';
import { CommonModule } from '@angular/common';
import { MonthComponent } from './month/month.component';
import { GoogleAuthService } from '../services/google/auth.service';
import { GoogleCalendarService } from '../services/google/calendar.service';
import { Event } from '../interfaces/event.interface';
import moment, { Moment } from 'moment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MonthComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  months: Month[] = [];

  events: Event[] = [
    {
      title: 'Test Event',
      description: 'This is a test event',
      start: new Date('2024-01-10'),
      end: new Date('2024-01-18'),
      colour: '#ff0000',
    },
    {
      title: 'Test Event',
      description: 'This is a test event',
      start: new Date('2024-01-14'),
      end: new Date('2024-01-14'),
      colour: '#00ff00',
    },
    {
      title: 'Test Event 2',
      description: 'This is a test event',
      start: new Date('2024-01-30'),
      end: new Date('2024-02-02'),
      colour: '#0000ff',
    },
    {
      title: 'Test Event 3',
      description: 'This is a test event',
      start: new Date('2024-02-18'),
      end: new Date('2024-02-18'),
      colour: '#aaaaaa',
    },
  ];

  constructor(
    public googleAuthService: GoogleAuthService,
    private googleCalendarService: GoogleCalendarService
  ) {}

  ngOnInit(): void {
    const date = new Date(`${new Date().getFullYear()}-01-01`);

    while (date.getFullYear() === new Date().getFullYear()) {
      const month = this.getMonth(date);
      const days: Day[] = [];
      const thisMonthEvents = this.events.filter(
        (event) =>
          date.getMonth() >= event.start.getMonth() &&
          date.getMonth() <= event.end.getMonth()
      );

      do {
        days.push({
          number: date.getDate(),
          weekDay: date.toLocaleString('default', {
            weekday: 'short',
          }) as WeekDay,
        });
        date.setDate(date.getDate() + 1);
      } while (month === this.getMonth(date));

      this.months.push({ name: month, days, events: thisMonthEvents } as Month);
    }
  }

  getMonth(date: Date) {
    return date.toLocaleString('default', { month: 'long' });
  }

  test() {
    this.googleCalendarService.getGoogleCalendarData();
  }
}
