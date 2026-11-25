import { Injectable, NgZone } from '@angular/core';
import { withViewTransition } from '../view-transition';
import { EventsListParameters } from './events-list/events-list.component';
import { EditEventParameters } from './event-edit/event-edit.component';
import { LeavePlannerParameters } from './leave-planner/leave-planner.component';
import { YearReviewParameters } from './year-review/year-review.component';
import { AskCalendarParameters } from './ask-calendar/ask-calendar.component';

type WindowType = 'list-events' | 'edit-event' | 'leave-planner' | 'year-review' | 'ask-calendar';

export interface WindowParameters {
  date: Date;
}

export type WindowParametersType =
  | EventsListParameters
  | EditEventParameters
  | LeavePlannerParameters
  | YearReviewParameters
  | AskCalendarParameters;

interface Window {
  type: WindowType;
  parameters?: WindowParametersType;
  side: 'left' | 'right';
  onCloseEvent?: ((closingParameters: any) => void) | null;
  onBackEvent?: (() => void) | null;
}

@Injectable()
export class WindowsService {
  constructor(private ngZone: NgZone) {}

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
    withViewTransition(this.ngZone, () => this.pop(true, closingParameters), 'panel');
  }

  closeAllWindows(): void {
    withViewTransition(this.ngZone, () => {
      while (this.anyWindowOpen()) this.pop(true);
    }, 'panel');
  }

  back(): void {
    withViewTransition(this.ngZone, () => this.pop(false), 'panel');
  }

  backAllWindows(): void {
    if (!this.anyWindowOpen()) return;
    withViewTransition(this.ngZone, () => {
      while (this.anyWindowOpen()) this.pop(false);
    }, 'panel');
  }

  // Pops the top window synchronously; the public methods animate it out
  private pop(isClose: boolean, closingParameters?: any): void {
    const closedWindow = this.windowQueue.pop();
    if (isClose) closedWindow?.onCloseEvent?.(closingParameters);
    else closedWindow?.onBackEvent?.();
  }
}
