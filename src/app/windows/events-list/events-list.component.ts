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
      const startsAndEndsAtMidnight =
        event.startMoment.hour() === 0 &&
        event.startMoment.minute() === 0 &&
        event.endMoment.hour() === 0 &&
        event.endMoment.minute() === 0;

      const startsSameDay = event.startMoment.isSame(this.parameters.date, 'day');
      const endsSameDay = event.endMoment.isSame(this.parameters.date, 'day');

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

    if (event.startsPreviousDay) return `➡️ - ${event.endMoment.format('HH:mm')}`;
    if (event.endsNextDay) return `${event.startMoment.format('HH:mm')} - ➡️`;

    return `${event.startMoment.format('HH:mm')} - ${event.endMoment.format('HH:mm')}`;
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

          // TODO: Update from full day event to in-day event and vice versa

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
