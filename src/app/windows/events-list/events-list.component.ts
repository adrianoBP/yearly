import { Component, Input } from '@angular/core';
import { WindowParameters, WindowsService } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import moment from 'moment';
import { Event } from '../../interfaces/event.interface';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CalendarService } from '../../services/calendar.service';
import { UtilService } from '../../services/util.service';

export interface EventsListParameters extends WindowParameters {
  events: Event[];
}

interface EventDisplayDetails extends Event {
  isAllDay: boolean;
  startsPreviousDay: boolean;
  endsNextDay: boolean;
}

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.css',
})
export class EventsListComponent {
  @Input() parameters!: EventsListParameters;

  constructor(
    public utilService: UtilService,
    private windowsService: WindowsService,
    private calendarService: CalendarService
  ) {}

  // FontAwesome icons
  faTrash = faTrash;

  // Properties
  events: EventDisplayDetails[] = [];
  eventsToDelete: Event[] = [];

  ngOnChanges(): void {
    this.events = this.parameters.events.map((event) => {
      const startDate = moment(event.start);
      const endDate = moment(event.end);

      const startsAndEndsAtMidnight =
        startDate.hour() === 0 &&
        startDate.minute() === 0 &&
        endDate.hour() === 0 &&
        endDate.minute() === 0;

      const startsSameDay = startDate.isSame(this.parameters.date, 'day');
      const endsSameDay = endDate.isSame(this.parameters.date, 'day');

      const isAllDay = startsAndEndsAtMidnight || (!startsSameDay && !endsSameDay);

      return {
        ...event,
        isAllDay,
        startsPreviousDay: !startsSameDay && !isAllDay,
        endsNextDay: !endsSameDay && !isAllDay,
      };
    });
  }

  getTime(event: EventDisplayDetails): string {
    if (event.isAllDay) return 'All day';

    const start = moment(event.start);
    const end = moment(event.end);

    if (event.startsPreviousDay) return `➡️ - ${end.format('HH:mm')}`;
    if (event.endsNextDay) return `${start.format('HH:mm')} - ➡️`;

    return `${start.format('HH:mm')} - ${end.format('HH:mm')}`;
  }

  removeEvent(event: Event): void {
    this.eventsToDelete.push(event);
    this.events = this.events!.filter((e) => e.id !== event.id);
  }

  async saveChanges(): Promise<void> {
    await this.calendarService.deleteEvents(this.eventsToDelete);
    this.windowsService.closeWindow(this.eventsToDelete); // Push events to delete to the parent window
  }
}
