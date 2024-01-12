import { Component } from '@angular/core';
import { Day, Month, WeekDay } from '../interfaces/month.interface';
import { CommonModule } from '@angular/common';
import { MonthComponent } from './month/month.component';
declare const testG: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MonthComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
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
