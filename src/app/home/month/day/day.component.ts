import { Component, Input } from '@angular/core';
import { Day } from '../../../interfaces/month.interface';
import { EventDay } from '../../../interfaces/event.interface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-day',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './day.component.html',
  styleUrl: './day.component.css',
})
export class DayComponent {
  @Input() day!: Day;
  @Input() events: EventDay[] | undefined;
}
