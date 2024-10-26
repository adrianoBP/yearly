import { Injectable } from '@angular/core';
import { Event } from '../interfaces/event.interface';

export type WindowType = 'list-events' | 'add-event';

export interface WindowParameters {
  eventsList?: Event[];
  date: Date;
}

@Injectable()
export class WindowsService {
  constructor() {}

  openedWindow: WindowType | null = null;
  parameters: WindowParameters = {
    eventsList: [],
    date: {} as Date,
  };

  openingSide: 'left' | 'right' = 'left';

  anyWindowOpen(): boolean {
    return this.openedWindow !== null;
  }

  isWindowOpen(type: WindowType): boolean {
    return this.openedWindow === type;
  }

  openWindow(
    type: WindowType,
    parameters?: WindowParameters,
    side: 'left' | 'right' = 'left'
  ): void {
    this.closeWindow(); // Ensure only one window is open at a time
    this.openedWindow = type;

    if (parameters) this.parameters = parameters;

    this.openingSide = side;
  }

  closeWindow(): void {
    this.openedWindow = null;
  }
}
