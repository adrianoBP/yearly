import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MonthComponent } from './month/month.component';
import { Day, WeekDay, Month } from './interfaces/month.interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MonthComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'yearly';

  months: Month[] = [];

  constructor() {
    const date = new Date(`${new Date().getFullYear()}-01-01`);

    while (date.getFullYear() === new Date().getFullYear()) {
      const month = this.getMonth(date);
      const days: Day[] = [];

      do {
        days.push({
          number: date.getDate(),
          weekDay: date.toLocaleString('default', {
            weekday: 'short',
          }) as WeekDay,
        });
        date.setDate(date.getDate() + 1);
      } while (month === this.getMonth(date));

      this.months.push({ name: month, days } as Month);
    }
  }

  getMonth(date: Date) {
    return date.toLocaleString('default', { month: 'long' });
  }
}
