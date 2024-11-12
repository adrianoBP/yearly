import { Injectable } from '@angular/core';

export interface Settings {
  allowedCalendars: string[]; // List of calendar IDs that the user wants to display
}

@Injectable()
export class SettingsService {
  constructor() {}

  private settings: Settings = {
    allowedCalendars: [],
  };

  getSettings(): Settings {
    const settings = localStorage.getItem('settings');
    if (settings) this.settings = JSON.parse(settings);
    return this.settings;
  }

  setSettings(settings: Settings) {
    this.settings = settings;
    localStorage.setItem('settings', JSON.stringify(this.settings));
  }
}
