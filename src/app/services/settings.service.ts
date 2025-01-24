import { Injectable } from '@angular/core';

export interface CalendarSettings {
  id: string;
  allowed: boolean;
  allowRecurring: boolean;
  allowBirthdays: boolean;
}

export interface Settings {
  calendars: CalendarSettings[];
}

@Injectable()
export class SettingsService {
  constructor() {}

  private settings: Settings = {
    calendars: [],
  };

  getSettings(): Settings {
    const settings = localStorage.getItem('settings');
    if (settings) {
      this.settings = JSON.parse(settings);
      if (!this.settings.calendars) this.settings.calendars = [];
    }
    return this.settings;
  }

  setSettings(settings: Settings) {
    this.settings = settings;
    localStorage.setItem('settings', JSON.stringify(this.settings));
  }
}
