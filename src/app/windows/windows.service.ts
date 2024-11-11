import { Injectable } from '@angular/core';
import { EventsListParameters } from './events-list/events-list.component';
import { EditEventParameters } from './event-edit/event-edit.component';

type WindowType = 'list-events' | 'edit-event';

export interface WindowParameters {
  date: Date;
}

export type WindowParametersType = EventsListParameters | EditEventParameters;

interface Window {
  type: WindowType;
  parameters?: WindowParametersType;
  side: 'left' | 'right';
  onCloseEvent?: ((closingParameters: any) => void) | null;
  onBackEvent?: (() => void) | null;
}

@Injectable()
export class WindowsService {
  constructor() {}

  windowQueue: Window[] = [];

  anyWindowOpen(): boolean {
    return this.windowQueue.length > 0;
  }

  openWindow(
    type: WindowType,
    parameters?: WindowParametersType,
    side: 'left' | 'right' | null = 'left',
    onCloseEvent: ((closingParameters: any) => void) | null = null,
    onBackEvent: (() => void) | null = null
  ): void {
    if (side == null) {
      side = this.getOpenedWindow()?.side == null ? 'left' : this.getOpenedWindow()!.side;
    }

    const window: Window = {
      type,
      parameters: parameters,
      side,
      onCloseEvent: onCloseEvent,
      onBackEvent: onBackEvent,
    };

    this.windowQueue.push(window);
  }

  getOpenedWindow(): Window | null {
    return this.windowQueue[this.windowQueue.length - 1] || null;
  }

  closeWindow(closingParameters?: any): void {
    const closedWindow = this.windowQueue.pop();
    if (closedWindow && closedWindow.onCloseEvent) {
      closedWindow.onCloseEvent(closingParameters);
    }
  }

  back(): void {
    const closedWindow = this.windowQueue.pop();
    if (closedWindow && closedWindow.onBackEvent) {
      closedWindow.onBackEvent();
    }
  }
}
