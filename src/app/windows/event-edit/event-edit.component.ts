import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFan } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';
import { Event, EventDisplayDetails } from '../../interfaces/event.interface';
import { CalendarService } from '../../services/api/calendar.service';
import { GoogleCalendar } from '../../services/google/calendar.service';
import { SettingsService } from '../../services/settings.service';
import { UserService } from '../../services/api/user.service';
import { UtilService } from '../../services/util.service';
import { WindowParameters, WindowsService } from '../windows.service';

export interface EditEventParameters extends WindowParameters {
  isNewEvent: boolean;
  event: EventDisplayDetails;

  // Options for new events
  startDate?: Date;
  endDate?: Date;
}

@Component({
  selector: 'app-event-edit',
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './event-edit.component.html',
  styleUrl: './event-edit.component.css',
})
export class EventEditComponent {
  // Font awesome icons
  fanIcon = faFan;

  parameters: EditEventParameters;

  // Properties
  calendars: GoogleCalendar[] = [];
  originalEvent: Event;
  isSaving: boolean = false;

  // Selection values
  eventStartDate: string | null = null;
  eventStartTime: string | null = null;
  eventEndDate: string | null = null;
  eventEndTime: string | null = null;
  selectedCalendar: GoogleCalendar | null = null;

  constructor(
    public utilService: UtilService,
    public calendarService: CalendarService,
    public windowsService: WindowsService,
    private settingsService: SettingsService,
    private userService: UserService
  ) {
    this.parameters = this.windowsService.getOpenedWindow()?.parameters as EditEventParameters;
    // Make a copy of the event to allow for cancelling changes
    this.originalEvent = { ...this.parameters.event };
  }

  async ngOnInit() {
    this.calendars = await this.getCalendars();

    this.eventStartDate = this.parameters.event.startMoment.format('YYYY-MM-DD');
    this.eventEndDate = this.parameters.event.endMoment.format('YYYY-MM-DD');
    this.eventStartTime = this.parameters.event.startMoment.format('HH:mm');
    this.eventEndTime = this.parameters.event.endMoment.format('HH:mm');

    this.selectedCalendar = this.parameters.isNewEvent
      ? this.calendars.find((calendar) => calendar.primary) || this.calendars[0]
      : this.calendars.find((calendar) => calendar.id === this.parameters.event.calendarId) || null;

    // Focus on the title input
    document.getElementById('event-title')?.focus();
  }

  async getCalendars(): Promise<GoogleCalendar[]> {
    const allowedCalendars = this.settingsService.getSettings().allowedCalendars;
    return (await this.calendarService.getCalendars()).filter(
      (calendar) =>
        // TODO: settings #3
        // allowedCalendars.includes(calendar.id)
        calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
    );
  }

  async saveChanges(): Promise<void> {
    this.isSaving = true;

    this.parameters.event.startMoment = moment(`${this.eventStartDate} ${this.eventStartTime}`);
    this.parameters.event.endMoment = moment(`${this.eventEndDate} ${this.eventEndTime}`);

    let event = this.parameters.event;
    this.parameters.event.calendarId = this.selectedCalendar?.id || '';

    if (this.parameters.isNewEvent) {
      event = { ...(await this.createEvent(event)) };
    } else {
      await this.updateEvent();
    }

    this.isSaving = false;

    this.windowsService.closeWindow(event);
  }

  async createEvent(event: EventDisplayDetails): Promise<EventDisplayDetails> {
    event = (await this.calendarService.createEvent(this.parameters.event)) as EventDisplayDetails;
    event.colour = this.selectedCalendar?.backgroundColor || event.colour;
    return event;
  }

  async updateEvent() {
    // Update the event using the original calendar ID
    await this.calendarService.updateEvent({
      ...this.parameters.event,
      calendarId: this.originalEvent.calendarId,
    });

    // Move the event if the calendar has changed
    if (this.parameters.event.calendarId !== this.originalEvent.calendarId) {
      await this.calendarService.moveEvent(this.parameters.event, this.originalEvent.calendarId);
    }
  }

  get canSave(): boolean {
    if (this.selectedCalendar == null || this.parameters.event.title == '') return false;

    const startMoment = moment(`${this.eventStartDate} ${this.eventStartTime}`);
    const endMoment = moment(`${this.eventEndDate} ${this.eventEndTime}`);

    return startMoment.isValid() && endMoment.isValid() && endMoment.isAfter(startMoment);
  }
}
