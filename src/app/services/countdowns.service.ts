import { Injectable, signal } from '@angular/core';
import moment from 'moment';
import { Event } from '../interfaces/event.interface';
import { PINS_KEY, Pin, activePins } from '../features/countdowns';

export const dayPinId = (date: Date) => 'day:' + moment(date).format('YYYY-MM-DD');

const toPin = (event: Event): Pin => ({
  id: event.id,
  title: event.title || '(No title)',
  start: event.startMoment.toISOString(),
  end: event.endMoment.toISOString(),
  colour: event.colour,
});

/** Events pinned for a countdown; kept on this device */
@Injectable()
export class CountdownsService {
  readonly pins = signal<Pin[]>(activePins(this.load()));

  /** Re-reads this device's pins: logging out clears them without reloading the app */
  reload() {
    this.pins.set(activePins(this.load()));
  }

  /** Pins still to come or on now (one that ends while the app is open drops off) */
  active(): Pin[] {
    return activePins(this.pins());
  }

  isPinned(id: string): boolean {
    return this.pins().some((pin) => pin.id === id);
  }

  toggle(event: Event) {
    if (this.isPinned(event.id)) this.unpin(event.id);
    else this.save([...this.pins(), toPin(event)]);
  }

  /** A whole day, pinned whether or not it has events */
  toggleDay(date: Date) {
    const id = dayPinId(date);
    if (this.isPinned(id)) return this.unpin(id);
    const day = moment(date).startOf('day');
    const title = day.format('ddd D MMM');
    this.save([...this.pins(), { id, title, start: day.toISOString(), end: day.clone().add(1, 'day').toISOString(), colour: 'var(--primary)' }]);
  }

  unpin(...ids: string[]) {
    if (ids.some((id) => this.isPinned(id))) this.save(this.pins().filter((pin) => !ids.includes(pin.id)));
  }

  /** Keeps pinned events' titles and dates in step with what the calendar loaded */
  refresh(events: Event[]) {
    let changed = false;
    const pins = this.pins().map((pin) => {
      const event = events.find((e) => e.id === pin.id);
      const fresh = event && toPin(event);
      if (!fresh || (fresh.title === pin.title && fresh.start === pin.start && fresh.end === pin.end && fresh.colour === pin.colour)) return pin;
      changed = true;
      return fresh;
    });
    if (changed) this.save(pins);
  }

  private save(pins: Pin[]) {
    const active = activePins(pins);
    this.pins.set(active);
    localStorage.setItem(PINS_KEY, JSON.stringify(active));
  }

  private load(): Pin[] {
    try {
      const pins = JSON.parse(localStorage.getItem(PINS_KEY) ?? '[]');
      return Array.isArray(pins) ? pins : [];
    } catch {
      return [];
    }
  }
}
