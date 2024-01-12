import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Day, WeekDay, Month } from '../../interfaces/month.interface';

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './month.component.html',
  styleUrl: './month.component.css',
})
export class MonthComponent {
  @Input() month!: Month;

  weekDays: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  constructor() {}

  get fillerDays() {
    const firstDayOfMonth = this.month.days[0].weekDay;
    return new Array(this.weekDays.indexOf(firstDayOfMonth));
  }
}
