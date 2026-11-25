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

/** "in 23 days", "tomorrow", "today", or "now" while it's on */
export function countdown(pin: Pin, now = moment()): string {
  const start = moment(pin.start);
  if (!start.isAfter(now)) return 'now';
  const days = start.clone().startOf('day').diff(now.clone().startOf('day'), 'days');
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}
