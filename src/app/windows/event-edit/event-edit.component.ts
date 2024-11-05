import { Component, Input } from '@angular/core';
import { WindowParameters } from '../windows.service';
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

  constructor(public utilService: UtilService, public calendarService: CalendarService) {}

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

    if (this.parameters.isNewEvent) {
      this.selectedCalendar =
        this.calendars.find((calendar) => calendar.primary) || this.calendars[0];
    } else {
      const startDate = moment(this.parameters.event.start);
      const endDate = moment(this.parameters.event.end);

      this.eventStartDate = startDate.format('YYYY-MM-DD');
      this.eventEndDate = endDate.format('YYYY-MM-DD');
      this.eventStartTime = startDate.format('HH:mm');
      this.eventEndTime = endDate.format('HH:mm');
    }
  }

  saveChanges(): void {
    if (this.parameters.isNewEvent) {
      // TODO: Add new event
    } else {
      // TODO: Update existing event
    }
  }

  get changesDetected(): boolean {
    return this.selectedCalendar !== null;
  }
}
