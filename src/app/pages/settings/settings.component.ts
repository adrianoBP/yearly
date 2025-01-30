import { Component, Inject } from '@angular/core';
import { CalendarService } from '../../services/api/calendar.service';
import { CommonModule } from '@angular/common';
import { GoogleCalendar } from '../../services/google/calendar.service';
import { Settings, SettingsService } from '../../services/settings.service';
import { UtilService } from '../../services/util.service';
import { Router } from '@angular/router';
import { UserService } from '../../services/api/user.service';
import { faCake, faInfinity } from '@fortawesome/free-solid-svg-icons';
import { faCalendarXmark } from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

type toggleSettingType = 'allowed' | 'recurring' | 'birthdays' | 'declined-events';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  constructor(
    public calendarService: CalendarService,
    public settingsService: SettingsService,
    public utilService: UtilService,
    @Inject(Router) public router: Router,
    public userService: UserService
  ) {}

  declineEventIcon = faCalendarXmark;
  infinityIcon = faInfinity;
  cakeIcon = faCake;

  calendars: GoogleCalendar[] = [];
  settings: Settings = {
    calendars: [],
  };

  async ngOnInit() {
    this.calendars = await this.calendarService.getCalendars();
    this.settings = this.settingsService.getSettings();

    // Add calendar to settings if missing
    for (const calendar of this.calendars) {
      const calendarSettings = this.settings.calendars.find((cal) => cal.id === calendar.id);
      if (calendarSettings == null)
        this.settings.calendars.push({
          id: calendar.id,
          allowed: false,
          allowRecurring: false,
          allowBirthdays: false,
          showDeclinedEvents: false,
        });
    }
  }

  isCalendarAllowed(calendarId: string) {
    return this.settings.calendars.find((cal) => cal.id === calendarId)?.allowed ?? false;
  }

  getCalendarSettings(calendarId: string) {
    return this.settings.calendars.find((cal) => cal.id === calendarId);
  }

  toggleSetting(calendarId: string, setting: toggleSettingType) {
    const calendar = this.settings.calendars.find((cal) => cal.id === calendarId);
    if (calendar == null) return;

    switch (setting) {
      case 'allowed':
        calendar.allowed = !calendar.allowed;
        break;
      case 'recurring':
        calendar.allowRecurring = !calendar.allowRecurring;
        break;
      case 'birthdays':
        calendar.allowBirthdays = !calendar.allowBirthdays;
        break;
      case 'declined-events':
        calendar.showDeclinedEvents = !calendar.showDeclinedEvents;
        break;
    }

    this.settingsService.setSettings(this.settings);
  }
}
