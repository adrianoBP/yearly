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
  darkMode?: boolean;
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

      if (!this.settings.hasOwnProperty('darkMode')) this.settings.darkMode = false;
    }
    return this.settings;
  }

  setSettings(settings: Settings) {
    this.settings = settings;
    localStorage.setItem('settings', JSON.stringify(this.settings));
  }

  setStyle() {
    this.getSettings();

    if (this.settings.darkMode) {
      document.documentElement.style.setProperty('--background-color', 'var(--grey-1000)');
      document.documentElement.style.setProperty('--font-color', 'var(--grey-200)');
      document.documentElement.style.setProperty(
        '--primary',
        'color-mix(in srgb, var(--blue) 50%, var(--white))'
      );
    } else {
      document.documentElement.style.setProperty('--background-color', 'white');
      document.documentElement.style.setProperty('--font-color', 'black');
      document.documentElement.style.setProperty('--primary', 'var(--blue)');
    }
  }
}
