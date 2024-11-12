import { Component } from '@angular/core';
import { WindowParameters, WindowsService } from '../windows.service';
import { Event } from '../../interfaces/event.interface';
import { UtilService } from '../../services/util.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CalendarService } from '../../services/calendar.service';
import { GoogleCalendar } from '../../services/google/calendar.service';
import moment from 'moment';
import { SettingsService } from '../../services/settings.service';
import { EventDisplayDetails } from '../events-list/events-list.component';

export interface EditEventParameters extends WindowParameters {
  isNewEvent: boolean;
  event: EventDisplayDetails;

  // Options for new events
  startDate?: Date;
  endDate?: Date;
}

@Component({
  selector: 'app-event-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './event-edit.component.html',
  styleUrl: './event-edit.component.css',
})
export class EventEditComponent {
  parameters: EditEventParameters;

  // Properties
  calendars: GoogleCalendar[] = [];

  // Selection values
  eventStartDate: string | null = null;
  eventStartTime: string | null = null;
  eventEndDate: string | null = null;
  eventEndTime: string | null = null;
  selectedCalendar: GoogleCalendar | null = null;

  originalEvent: Event;

  constructor(
    public utilService: UtilService,
    public calendarService: CalendarService,
    public windowsService: WindowsService,
    private settingsService: SettingsService
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
    this.parameters.event.startMoment = moment(`${this.eventStartDate} ${this.eventStartTime}`);
    this.parameters.event.endMoment = moment(`${this.eventEndDate} ${this.eventEndTime}`);

    let event = this.parameters.event;
    this.parameters.event.calendarId = this.selectedCalendar?.id || '';

    if (this.parameters.isNewEvent) {
      event = (await this.calendarService.createEvent(
        this.parameters.event
      )) as EventDisplayDetails;
      event.colour = this.selectedCalendar?.backgroundColor || event.colour;
    } else {
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

    this.windowsService.closeWindow(event);
  }

  get canSave(): boolean {
    if (this.selectedCalendar == null || this.parameters.event.title == '') return false;

    const startMoment = moment(`${this.eventStartDate} ${this.eventStartTime}`);
    const endMoment = moment(`${this.eventEndDate} ${this.eventEndTime}`);

    return startMoment.isValid() && endMoment.isValid() && endMoment.isAfter(startMoment);
  }
}
