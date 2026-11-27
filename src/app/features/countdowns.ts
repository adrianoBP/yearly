import moment from 'moment';

export const PINS_KEY = 'pinnedEvents';

/** A pinned event, stored whole so its countdown shows whichever year is on screen */
export interface Pin {
  id: string;
  title: string;
  start: string;
  end: string;
  colour: string;
}

/** Pins that haven't ended, soonest first */
export function activePins(pins: Pin[], now = moment()): Pin[] {
  return pins.filter((pin) => moment(pin.end).isAfter(now)).sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());
}

/** "in 23 days", "tomorrow", "in 3h 20m" later today, or "now" while it's on */
export function countdown(pin: Pin, now = moment()): string {
  const start = moment(pin.start);
  if (!start.isAfter(now)) return 'now';
  const days = start.clone().startOf('day').diff(now.clone().startOf('day'), 'days');
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  // Rounded up, so it never reads "in 0m" before it starts
  const minutes = Math.ceil(start.diff(now) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `in ${[h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ')}`;
}
