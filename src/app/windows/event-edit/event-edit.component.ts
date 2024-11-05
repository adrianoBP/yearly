import { Component, Input } from '@angular/core';
import { WindowParameters, WindowsService } from '../windows.service';
import { Event } from '../../interfaces/event.interface';
import { UtilService } from '../../services/util.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CalendarService } from '../../services/calendar.service';
import { GoogleCalendar } from '../../services/google/calendar.service';
import moment from 'moment';

export interface EditEventParameters extends WindowParameters {
  isNewEvent: boolean;
  event: Event;

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
  @Input() parameters!: EditEventParameters;

  constructor(
    public utilService: UtilService,
    public calendarService: CalendarService,
    private windowsService: WindowsService
  ) {}

  // Properties
  calendars: GoogleCalendar[] = [];

  // Selection values
  selectedCalendar: GoogleCalendar | null = null;

  eventStartDate: string | null = null;
  eventStartTime: string | null = null;
  eventEndDate: string | null = null;
  eventEndTime: string | null = null;

  async ngOnInit() {
    this.calendars = await this.calendarService.getCalendars();

    this.eventStartDate = this.parameters.event.startMoment.format('YYYY-MM-DD');
    this.eventEndDate = this.parameters.event.endMoment.format('YYYY-MM-DD');
    this.eventStartTime = this.parameters.event.startMoment.format('HH:mm');
    this.eventEndTime = this.parameters.event.endMoment.format('HH:mm');

    if (this.parameters.isNewEvent) {
      this.selectedCalendar =
        this.calendars.find((calendar) => calendar.primary) || this.calendars[0];
    }

    // Focus on the title input
    document.getElementById('event-title')?.focus();
  }

  async saveChanges(): Promise<void> {
    this.parameters.event.startMoment = moment(`${this.eventStartDate} ${this.eventStartTime}`);
    this.parameters.event.endMoment = moment(`${this.eventEndDate} ${this.eventEndTime}`);

    let event = this.parameters.event;

    if (this.parameters.isNewEvent) {
      this.parameters.event.calendarId = this.selectedCalendar?.id || '';

      event = await this.calendarService.createEvent(this.parameters.event);
      event.colour = this.selectedCalendar?.backgroundColor || event.colour;
    } else {
      // TODO: Update existing event
    }

    this.windowsService.closeWindow(event); // Push events to delete to the parent window
  }

  get canSave(): boolean {
    // TODO: Check end date is after start date (or all day)
    return this.selectedCalendar !== null && this.parameters.event.title !== '';
  }
}
