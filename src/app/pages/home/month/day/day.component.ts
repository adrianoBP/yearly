import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Day } from '../../../../interfaces/month.interface';
import { Event } from '../../../../interfaces/event.interface';
import { CommonModule } from '@angular/common';
import moment from 'moment';

interface EventIcon {
  enabled: boolean;
  icon: string;
}

@Component({
  selector: 'app-day',
  standalone: true,
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

  today;
  constructor() {
    this.today = moment();
  }

  eventColours: string[] = [];
  isStartDay = false;
  isEndDay = false;
  isMultiDay = false;

  eventIcons: { [key: string]: EventIcon } = {
    flight: { enabled: false, icon: '✈️' } as EventIcon,
  };

  ngOnChanges(): void {
    for (const event of this.events) {
      if (!this.eventColours.includes(event.colour)) {
        this.eventColours.push(event.colour);
      }

      const eventIsStartDay = moment(event.start).isSame(this.day.date, 'day');
      const eventIsEndDay = moment(event.end).subtract(1, 'second').isSame(this.day.date, 'day');

      this.isMultiDay = this.isMultiDay || !eventIsStartDay || !eventIsEndDay;
      this.isStartDay = this.isStartDay || eventIsStartDay;
      this.isEndDay = this.isEndDay || eventIsEndDay;

      // Enable custom icons for specific events
      if (event.title.toLowerCase().includes('flight')) {
        this.eventIcons['flight'].enabled = true;
      }
    }
  }

  onClick(mouseEvent: MouseEvent): void {
    this.onDayClick.emit({ day: this.day, mouseEvent });
  }

  get isToday(): boolean {
    return this.today.isSame(this.day.date, 'day');
  }

  get isPast(): boolean {
    return this.today.isAfter(this.day.date, 'day');
  }

  get sortedEvents(): Event[] {
    return this.events.sort((a, b) => b.duration - a.duration);
  }

  get eventCalendars() {
    // group events by calendar
    const eventsByCalendar: { [key: string]: string } = {};
    for (const event of this.events) {
      if (!eventsByCalendar[event.calendarId]) {
        eventsByCalendar[event.calendarId] = event.colour;
      }
    }

    // return a list
    return Object.keys(eventsByCalendar).map((key) => ({
      calendarId: key,
      colour: eventsByCalendar[key],
    }));
  }

  get getEnabledIcons() {
    return Object.keys(this.eventIcons)
      .filter((key) => this.eventIcons[key].enabled)
      .map((key) => this.eventIcons[key].icon);
  }
}
