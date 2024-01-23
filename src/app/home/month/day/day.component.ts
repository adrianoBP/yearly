import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Day } from '../../../interfaces/month.interface';
import { EventDay } from '../../../interfaces/event.interface';
import { CommonModule } from '@angular/common';
import moment from 'moment';

@Component({
  selector: 'app-day',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './day.component.html',
  styleUrl: './day.component.css',
})
export class DayComponent {
  @Input() day!: Day;
  @Input() events: EventDay[] = [];
  @Input() canCreateNewEvent!: boolean;
  @Output() onDayClick = new EventEmitter<{
    day: Day;
    mouseEvent: MouseEvent;
  }>();

  onClick(mouseEvent: MouseEvent): void {
    this.onDayClick.emit({ day: this.day, mouseEvent });
  }

  get isToday(): boolean {
    return moment().isSame(this.day.date, 'day');
  }

  get isPast(): boolean {
    return moment().isAfter(this.day.date, 'day');
  }

  get sortedEvents(): EventDay[] {
    return this.events.sort((a, b) => b.duration - a.duration);
  }
}
