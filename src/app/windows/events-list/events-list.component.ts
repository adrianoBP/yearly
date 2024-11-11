import { Component } from '@angular/core';
import { WindowParameters, WindowsService } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import moment from 'moment';
import { Event } from '../../interfaces/event.interface';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CalendarService } from '../../services/calendar.service';
import { UtilService } from '../../services/util.service';
import { EditEventParameters } from '../event-edit/event-edit.component';
import { GoogleCalendar } from '../../services/google/calendar.service';

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
  // FontAwesome icons
  faTrash = faTrash;

  // Properties
  parameters: EventsListParameters;
  events: EventDisplayDetails[] = [];
  eventsToDelete: Event[] = [];
  eventsToUpdate: Event[] = [];

  availableCalendars: GoogleCalendar[] = [];

  constructor(
    public utilService: UtilService,
    private windowsService: WindowsService,
    private calendarService: CalendarService
  ) {
    this.parameters = this.windowsService.getOpenedWindow()?.parameters as EventsListParameters;
  }

  async ngOnInit(): Promise<void> {
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

    this.availableCalendars = await this.calendarService.getCalendars();
  }

  getTime(event: EventDisplayDetails): string {
    if (event.isAllDay) return 'All day';

    const start = moment(event.start);
    const end = moment(event.end);

    if (event.startsPreviousDay) return `➡️ - ${end.format('HH:mm')}`;
    if (event.endsNextDay) return `${start.format('HH:mm')} - ➡️`;

    return `${start.format('HH:mm')} - ${end.format('HH:mm')}`;
  }

  openEvent(event: Event): void {
    this.windowsService.openWindow(
      'edit-event',
      {
        event,
        isNewEvent: false,
      } as EditEventParameters,
      null,
      (updatedEvent: Event) => {
        if (updatedEvent) {
          // Update the event colour
          updatedEvent.colour = this.utilService.getCalendarColour(
            updatedEvent.calendarId,
            this.availableCalendars
          );

          event.colour = updatedEvent.colour;

          // TODO: Check how to update the time + what happens to full days?

          // Remove the old event from the list
          this.eventsToUpdate = this.eventsToUpdate.filter((e) => e.id !== updatedEvent.id);
          this.eventsToUpdate.push(updatedEvent);
        }
      }
    );
  }

  removeEvent(event: Event): void {
    this.eventsToDelete.push(event);
    this.events = this.events!.filter((e) => e.id !== event.id);
  }

  async saveChanges(): Promise<void> {
    await this.calendarService.deleteEvents(this.eventsToDelete);

    this.windowsService.closeWindow({
      deletedEvents: this.eventsToDelete,
      updatedEvents: this.eventsToUpdate,
    });
  }
}
