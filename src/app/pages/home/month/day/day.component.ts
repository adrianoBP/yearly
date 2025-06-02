import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { Day } from '../../../../interfaces/month.interface';
import { Event } from '../../../../interfaces/event.interface';
import { CommonModule } from '@angular/common';
import moment from 'moment';
import { CalendarService } from '../../../../services/api/calendar.service';

interface EventIcon {
  enabled: boolean;
  icon: string;
}

@Component({
  selector: 'app-day',
  imports: [CommonModule],
  templateUrl: './day.component.html',
  styleUrl: './day.component.css',
})
export class DayComponent {
  @Input() day!: Day;
  @Input() events: Event[] = [];
  @Input() canCreateNewEvent!: boolean;
  @Output() onDayClick = new EventEmitter<{
    day: Day;
    mouseEvent: MouseEvent;
  }>();

  today: moment.Moment;
  dayId: string = '';

  // Properties
  isToday: boolean = false;
  isPast: boolean = false;
  sortedEvents: Event[] = [];
  enabledIcons: string[] = [];

  constructor(public calendarService: CalendarService) {
    this.today = moment();
  }

  eventColours: string[] = [];

  // List of icons for the events
  eventIcons: { [key: string]: EventIcon } = {
    flight: { enabled: false, icon: '✈️' } as EventIcon,
    ferry: { enabled: false, icon: '🚢' } as EventIcon,
    train: { enabled: false, icon: '🚅' } as EventIcon,
    bus: { enabled: false, icon: '🚌' } as EventIcon,
  };

  ngOnChanges(changes: {
    events: { previousValue: any[]; currentValue: any[]; firstChange: boolean };
  }): void {
    if (
      !changes.events.firstChange &&
      changes.events.currentValue.length == 0 &&
      changes.events.previousValue.length == 0
    )
      return;

    // Ensure we have a unique day id to be able to scroll to this element
    this.dayId = `day-${this.day.date.getDate()}-${this.day.date.getMonth()}-${this.day.date.getFullYear()}`;

    for (const event of this.events) {
      if (!this.eventColours.includes(event.colour)) {
        this.eventColours.push(event.colour);
      }

      const availableIcons = Object.keys(this.eventIcons)
        .map((key) => ({
          type: key,
          index: event.title.toLowerCase().indexOf(key),
        }))
        .filter((index) => index.index > -1);

      // Enable the icon with the first index
      if (availableIcons.length > 0) {
        const highestPriorityIndex = availableIcons.reduce((prev, current) =>
          current.index > prev.index ? prev : current
        );
        this.eventIcons[highestPriorityIndex.type].enabled = true;
      }
    }

    this.updatedParameters();
  }

  updatedParameters(): void {
    this.isToday = this.today.isSame(this.day.date, 'day');
    this.isPast = this.today.isAfter(this.day.date, 'day');
    this.sortedEvents = this.events.sort((a, b) => b.duration - a.duration);

    // ? Currently only supporting one icon per day due to space constraints
    this.enabledIcons = [
      Object.keys(this.eventIcons)
        .filter((key) => this.eventIcons[key].enabled)
        .map((key) => this.eventIcons[key].icon)[0],
    ];
  }

  onClick(mouseEvent: MouseEvent): void {
    this.onDayClick.emit({ day: this.day, mouseEvent });
  }
}
