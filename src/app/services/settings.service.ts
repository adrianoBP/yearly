import { Injectable } from '@angular/core';

export interface CalendarSettings {
  id: string;
  allowed: boolean;
  allowRecurring: boolean;
  allowBirthdays: boolean;
  showDeclinedEvents: boolean;
}
export interface Settings {
  calendars: CalendarSettings[];
  showDisabledCalendars?: boolean;
  closeAllWindows?: boolean;
}

@Injectable()
export class SettingsService {
  constructor() {}

  private settings: Settings = {
    calendars: [],
  };

  getSettings(): Settings {
    const storedSettings = localStorage.getItem('settings');
    if (storedSettings) {
      this.settings = JSON.parse(storedSettings);
      if (!this.settings.calendars) this.settings.calendars = [];

      if (!this.settings.hasOwnProperty('showDisabledCalendars'))
        this.settings.showDisabledCalendars = false;

      if (!this.settings.hasOwnProperty('closeAllWindows')) this.settings.closeAllWindows = false;
    }
    return this.settings;
  }

  setSettings(settings: Settings) {
    this.settings = settings;
    localStorage.setItem('settings', JSON.stringify(this.settings));
  }
}
