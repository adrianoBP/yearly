import { Component } from '@angular/core';
import { CalendarService } from '../../services/calendar.service';
import { CommonModule } from '@angular/common';
import { GoogleCalendar } from '../../services/google/calendar.service';
import { Settings, SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  constructor(
    private calendarService: CalendarService,
    private settingsService: SettingsService
  ) {}

  calendars: GoogleCalendar[] = [];
  settings: Settings = {
    allowedCalendars: [],
  };

  async ngOnInit() {
    this.settings = this.settingsService.getSettings();
    this.calendars = await this.calendarService.getCalendars();
  }

  getCalendarName(calendar: GoogleCalendar) {
    return calendar.summaryOverride || calendar.summary;
  }

  isCalendarAllowed(calendarId: string) {
    return this.settings.allowedCalendars.includes(calendarId);
  }

  toggleCalendar(calendarId: string) {
    if (this.isCalendarAllowed(calendarId)) {
      this.settings.allowedCalendars = this.settings.allowedCalendars.filter(
        (id) => id !== calendarId
      );
    } else {
      this.settings.allowedCalendars.push(calendarId);
    }

    this.settingsService.setSettings(this.settings);
  }
}
