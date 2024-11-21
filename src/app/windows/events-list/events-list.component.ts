import { Component } from '@angular/core';
import { WindowParameters, WindowsService } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Event } from '../../interfaces/event.interface';
import { faTrash, faFan, faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CalendarService } from '../../services/api/calendar.service';
import { UtilService } from '../../services/util.service';
import { EditEventParameters } from '../event-edit/event-edit.component';
import { GoogleCalendar } from '../../services/google/calendar.service';
import { AuthService } from '../../services/api/auth.service';
import { UserService } from '../../services/api/user.service';

export interface EventsListParameters extends WindowParameters {
  events: Event[];
}

export interface EventDisplayDetails extends Event {
  isAllDay: boolean;
  startsBefore: boolean;
  endsAfter: boolean;
}

@Component({
  selector: 'app-events-list',
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.css',
})
export class EventsListComponent {
  // FontAwesome icons
  faTrash = faTrash;
  fanIcon = faFan;
  faLock = faLock;

  // Properties
  parameters: EventsListParameters;
  events: EventDisplayDetails[] = [];
  eventsToDelete: Event[] = [];
  eventsToUpdate: Event[] = [];
  isSaving: boolean = false;

  availableCalendars: GoogleCalendar[] = [];

  constructor(
    public utilService: UtilService,
    private windowsService: WindowsService,
    private calendarService: CalendarService,
    public authService: AuthService,
    public userService: UserService
  ) {
    this.parameters = this.windowsService.getOpenedWindow()?.parameters as EventsListParameters;
  }

  async ngOnInit(): Promise<void> {
    this.events = this.parameters.events.map(this.eventToDisplayEvent.bind(this));
    this.availableCalendars = await this.calendarService.getCalendars();
  }

  eventToDisplayEvent(event: Event): EventDisplayDetails {
    const startsAtMidnight = event.startMoment.hour() === 0 && event.startMoment.minute() === 0;
    const endsAtMidnight = event.endMoment.hour() === 0 && event.endMoment.minute() === 0;
    const endsTonightAtMidnight =
      endsAtMidnight &&
      event.endMoment.clone().subtract(1, 'day').isSame(this.parameters.date, 'day');

    const startsBeforeDate = event.startMoment.isBefore(this.parameters.date, 'day');
    const endsAfterDate =
      event.endMoment.isAfter(this.parameters.date, 'day') && !endsTonightAtMidnight;

    const isAllDay = (startsBeforeDate || startsAtMidnight) && (endsAfterDate || endsAtMidnight);

    return {
      ...event,
      isAllDay,
      startsBefore: startsBeforeDate,
      endsAfter: endsAfterDate,
    };
  }

  getTime(event: EventDisplayDetails): string {
    if (event.isAllDay) return 'All day';

    if (event.startsBefore) return `➡️ - ${event.endMoment.format('HH:mm')}`;
    if (event.endsAfter) return `${event.startMoment.format('HH:mm')} - ➡️`;

    return `${event.startMoment.format('HH:mm')} - ${event.endMoment.format('HH:mm')}`;
  }

  openEvent(event: EventDisplayDetails): void {
    const originalEvent = { ...event };
    this.windowsService.openWindow(
      'edit-event',
      {
        event,
        isNewEvent: false,
      } as EditEventParameters,
      null,
      (updatedEvent: EventDisplayDetails) => {
        // on SAVE
        if (updatedEvent) {
          // Update the event colour
          updatedEvent.colour = this.utilService.getCalendarColour(
            updatedEvent.calendarId,
            this.availableCalendars
          );

          // Update time display
          const { isAllDay, startsBefore, endsAfter } = this.eventToDisplayEvent(updatedEvent);
          updatedEvent.isAllDay = isAllDay;
          updatedEvent.startsBefore = startsBefore;
          updatedEvent.endsAfter = endsAfter;

          // Remove the old event from the list
          this.eventsToUpdate = this.eventsToUpdate.filter((e) => e.id !== updatedEvent.id);
          this.eventsToUpdate.push(updatedEvent);
        }
      },
      () => {
        // on BACK
        Object.assign(event, originalEvent);
      }
    );
  }

  removeEvent(event: Event): void {
    this.eventsToDelete.push(event);
    this.events = this.events!.filter((e) => e.id !== event.id);
  }

  async saveChanges(): Promise<void> {
    this.isSaving = true;
    await this.calendarService.deleteEvents(this.eventsToDelete);
    this.isSaving = false;

    this.windowsService.closeWindow({
      deletedEvents: this.eventsToDelete,
      updatedEvents: this.eventsToUpdate,
    });
  }
}
