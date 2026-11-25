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
  /** Feature id → switched on; a missing entry means on */
  features?: Record<string, boolean>;
  /** Leave planner: ISO country code (e.g. GB) and optional region (e.g. GB-SCT); also "home" for trip prep */
  holidayCountry?: string;
  holidayRegion?: string | null;
}

/** Country from the browser's locale (en-GB → GB), used until the user picks one */
export function homeCountry(settings: Settings): string {
  return settings.holidayCountry ?? navigator.language.split('-')[1]?.toUpperCase() ?? 'GB';
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
}
