
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as lucide from 'lucide';
import { IconComponent } from '../../shared/icon/icon.component';
import moment from 'moment';
import { Event, EventDisplayDetails } from '../../interfaces/event.interface';
import { CalendarService } from '../../services/api/calendar.service';
import { GoogleCalendar } from '../../services/google/calendar.service';
import { SettingsService } from '../../services/settings.service';
import { UserService } from '../../services/api/user.service';
import { UtilService } from '../../services/util.service';
import { WindowParameters, WindowsService } from '../windows.service';
import { DatePickerComponent } from '../../shared/date-picker/date-picker.component';
import { EventExtrasComponent } from './event-extras/event-extras.component';
import { FeaturesService } from '../../services/features.service';
import { parseEventText } from '../../features/text-event';

export interface EditEventParameters extends WindowParameters {
  isNewEvent: boolean;
  event: EventDisplayDetails;

  // Options for new events
  startDate?: Date;
  endDate?: Date;
  /** Opened from "Type it": start in the plain-text box */
  focusQuickAdd?: boolean;
  /** The other events of that day, for travel times between them */
  neighbours?: Event[];
}

@Component({
  selector: 'app-event-edit',
  imports: [FormsModule, IconComponent, DatePickerComponent, EventExtrasComponent],
  templateUrl: './event-edit.component.html',
  styleUrl: './event-edit.component.css',
})
export class EventEditComponent {
  // Font awesome icons
  closeIcon = lucide.X;
  clockIcon = lucide.Clock;
  calendarIcon = lucide.Calendar;
  lockIcon = lucide.Lock;
  locationIcon = lucide.MapPin;
  mapIcon = lucide.MapPinned;
  descriptionIcon = lucide.TextAlignStart;
  externalIcon = lucide.ExternalLink;

  parameters: EditEventParameters;

  // Properties
  calendars: GoogleCalendar[] = [];
  originalEvent: Event;
  isSaving: boolean = false;
  saveError = '';

  // Selection values. For all-day events eventEndDate is the last day (inclusive).
  isAllDay = false;
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
    private userService: UserService,
    public features: FeaturesService
  ) {
    this.parameters = this.windowsService.getOpenedWindow()?.parameters as EditEventParameters;
    // Make a copy of the event to allow for cancelling changes
    this.originalEvent = { ...this.parameters.event };
  }

  async ngOnInit() {
    const { startMoment, endMoment } = this.parameters.event;
    this.isAllDay =
      startMoment.format('HH:mm') === '00:00' &&
      endMoment.format('HH:mm') === '00:00' &&
      endMoment.isAfter(startMoment);

    this.eventStartDate = startMoment.format('YYYY-MM-DD');
    // Google all-day events end at midnight after the last day; show the last day instead
    this.eventEndDate = (this.isAllDay ? endMoment.clone().subtract(1, 'day') : endMoment).format(
      'YYYY-MM-DD'
    );
    this.eventStartTime = startMoment.format('HH:mm');
    this.eventEndTime = endMoment.format('HH:mm');

    this.calendars = await this.getCalendars();
    this.selectedCalendar = this.parameters.isNewEvent
      ? this.calendars.find((calendar) => calendar.primary) || this.calendars[0]
      : this.calendars.find((calendar) => calendar.id === this.parameters.event.calendarId) || null;

    // A new event starts with typing its title; an existing one is mostly read, so no field (and no phone keyboard) jumps up
    if (this.parameters.isNewEvent) document.getElementById(this.parameters.focusQuickAdd ? 'quick-add' : 'event-title')?.focus();
  }

  async getCalendars(): Promise<GoogleCalendar[]> {
    const settings = this.settingsService.getSettings();
    const allowedCalendars = settings.showDisabledCalendars
      ? []
      : settings.calendars.filter((cal) => cal.allowed).map((cal) => cal.id);
    return (await this.calendarService.getCalendars()).filter(
      (calendar) =>
        (allowedCalendars.length == 0 || allowedCalendars.includes(calendar.id)) &&
        (calendar.accessRole === 'owner' || calendar.accessRole === 'writer')
    );
  }

  toggleAllDay() {
    this.isAllDay = !this.isAllDay;
    // Coming from all-day, give the event a sensible one-hour slot
    if (!this.isAllDay && this.eventStartTime === '00:00' && this.eventEndTime === '00:00') {
      this.eventStartTime = '09:00';
      this.eventEndTime = '10:00';
    }
  }

  // Keep the end from landing before the start when the start date moves
  onStartDateChange() {
    if (this.eventStartDate && this.eventEndDate && this.eventEndDate < this.eventStartDate)
      this.eventEndDate = this.eventStartDate;
  }

  /** Start and end as Google expects them: all-day events end at midnight after the last day */
  private getRange(): { start: moment.Moment; end: moment.Moment } {
    if (this.isAllDay) {
      return {
        start: moment(this.eventStartDate, 'YYYY-MM-DD', true),
        end: moment(this.eventEndDate, 'YYYY-MM-DD', true).add(1, 'day'),
      };
    }
    return {
      start: moment(`${this.eventStartDate} ${this.eventStartTime}`, 'YYYY-MM-DD HH:mm', true),
      end: moment(`${this.eventEndDate} ${this.eventEndTime}`, 'YYYY-MM-DD HH:mm', true),
    };
  }

  quickText = '';
  quickNote = '';

  /** Fills the fields from text like "dinner Friday 8pm at Rosie's" */
  applyQuickAdd() {
    const text = this.quickText.trim();
    if (!text) return;
    const parsed = parseEventText(text);
    if (parsed == null) {
      this.parameters.event.title = text;
      this.quickNote = "Couldn't find a date in that. Set it below.";
      return;
    }
    const start = moment(parsed.start);
    const end = moment(parsed.end);
    this.parameters.event.title = parsed.title || this.parameters.event.title;
    if (parsed.location) this.parameters.event.location = parsed.location;
    this.isAllDay = parsed.allDay;
    this.eventStartDate = start.format('YYYY-MM-DD');
    this.eventEndDate = (parsed.allDay ? end.clone().subtract(1, 'day') : end).format('YYYY-MM-DD');
    if (!parsed.allDay) {
      this.eventStartTime = start.format('HH:mm');
      this.eventEndTime = end.format('HH:mm');
    }
    this.quickText = '';
    this.quickNote = 'Filled in below. Check it, then save.';
  }

  /** For the extras section: plain strings so change detection sees no change until the dates do */
  get rangeStart(): string {
    const { start, end } = this.getRange();
    return start.isValid() && end.isValid() ? start.format() : '';
  }

  get rangeEnd(): string {
    const { start, end } = this.getRange();
    return start.isValid() && end.isValid() ? end.format() : '';
  }

  async saveChanges(): Promise<void> {
    if (!this.canSave || this.isSaving) return;
    this.isSaving = true;
    this.saveError = '';

    const { start, end } = this.getRange();
    this.parameters.event.startMoment = start;
    this.parameters.event.endMoment = end;

    let event = this.parameters.event;
    this.parameters.event.calendarId = this.selectedCalendar?.id || '';

    try {
      if (this.parameters.isNewEvent) {
        event = { ...(await this.createEvent(event)) };
      } else {
        await this.updateEvent();
      }
    } catch (e) {
      // Keep the panel open with the user's input so they can retry
      console.error(e);
      this.saveError = "Couldn't save to Google Calendar. Try again.";
      return;
    } finally {
      this.isSaving = false;
    }

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

  /** Who organised the event, when it was someone else (group calendars only have an id) */
  /** Google Maps' universal link: the Maps app on phones, the website elsewhere */
  mapsUrl(location: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
  }

  get organiser(): string | null {
    const organizer = this.parameters.event.organizer;
    if (!organizer?.email || organizer.self || organizer.email.endsWith('calendar.google.com')) return null;
    return organizer.email;
  }

  get canSave(): boolean {
    if (this.selectedCalendar == null || !this.parameters.event.title?.trim()) return false;
    const { start, end } = this.getRange();
    return start.isValid() && end.isValid() && end.isAfter(start);
  }
}
