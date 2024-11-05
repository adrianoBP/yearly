import { Injectable } from '@angular/core';
import { EventsListParameters } from './events-list/events-list.component';
import { EditEventParameters } from './event-edit/event-edit.component';

type WindowType = 'list-events' | 'edit-event';

export interface WindowParameters {
  date: Date;
}

export type WindowParametersType = EventsListParameters | EditEventParameters;

@Injectable()
export class WindowsService {
  constructor() {}

  // Live data
  openedWindow: WindowType | null = null;
  parameters: WindowParametersType | null = null;
  onClosingEvent: ((closingParameters: any) => void) | null = null;

  openingSide: 'left' | 'right' = 'left';

  anyWindowOpen(): boolean {
    return this.openedWindow !== null;
  }

  isWindowOpen(type: WindowType): boolean {
    return this.openedWindow === type;
  }

  openWindow(
    type: WindowType,
    parameters?: WindowParametersType,
    side: 'left' | 'right' = 'left',
    onCloseEvent: ((closingParameters: any) => void) | null = null
  ): void {
    this.closeWindow(); // Ensure only one window is open at a time
    this.openedWindow = type;

    if (parameters) this.parameters = parameters;

    this.openingSide = side;
    this.onClosingEvent = onCloseEvent;
  }

  closeWindow(closingParameters?: any): void {
    this.openedWindow = null;

    if (this.onClosingEvent) {
      this.onClosingEvent(closingParameters);
      this.onClosingEvent = null;
    }
  }
}
