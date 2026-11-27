import moment from 'moment';
import { NearbyEvent } from './crowd';
import { Verdict } from './travel';
import { Event } from '../interfaces/event.interface';

/** A notification for the Yearly server to send at `at` (ms) */
export interface Alert {
  id: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

/** What the app found out about one upcoming event */
export interface EventFindings {
  id: string;
  title: string;
  start: Date;
  /** Concerts and matches near the venue */
  crowds?: NearbyEvent[];
  /** Drive from home, when the home address and a TomTom key are set */
  home?: { minutes: number; trafficMinutes: number; leaveBy: Date };
  /** Weather warnings for the event's first day */
  weather?: string[];
  /** The next event, when getting there is tight or late */
  next?: { title: string; minutes: number; gap: number; verdict: Verdict };
}

/** Alerts are worked out for events up to this far ahead */
export const ALERT_DAYS = 3;
/** A leave alert goes out this long before the leave-by time */
const LEAVE_EARLY_MINUTES = 15;
/** Traffic counts as worth a warning from this many minutes of delay */
const TRAFFIC_MINUTES = 10;

const time = (date: Date | number) => moment(date).format('HH:mm');

/**
 * Turns findings into notifications. Only warnings become alerts, so a normal day sends nothing,
 * and an alert whose time has passed is left out (the next list replaces it anyway).
 */
export function buildAlerts(findings: EventFindings[], now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const add = (alert: Alert) => {
    if (alert.at > now.getTime()) alerts.push(alert);
  };

  for (const f of findings) {
    const title = f.title || '(No title)';
    const crowd = f.crowds?.[0];
    const crowdLine = crowd ? `${crowd.name} is on nearby at ${time(crowd.start)}` : '';

    if (f.home && (crowd || f.home.trafficMinutes >= TRAFFIC_MINUTES)) {
      const reason = crowdLine || `traffic adds ${f.home.trafficMinutes} min`;
      add({
        id: `leave:${f.id}`,
        at: f.home.leaveBy.getTime() - LEAVE_EARLY_MINUTES * 60_000,
        title: `Leave by ${time(f.home.leaveBy)} for ${title}`,
        body: `${f.home.minutes} min drive; ${reason}.`,
        url: '/home',
      });
    } else if (crowd) {
      // No home address: warn a couple of hours ahead instead
      add({
        id: `crowd:${f.id}`,
        at: f.start.getTime() - 2 * 3600_000,
        title: `Busy near ${title}`,
        body: `${crowdLine}${crowd.distanceKm != null ? `, ${crowd.distanceKm} km away` : ''}. Allow extra time.`,
        url: '/home',
      });
    }

    if (f.weather?.length) {
      add({
        id: `weather:${f.id}`,
        at: moment(f.start).subtract(1, 'day').hour(19).startOf('hour').valueOf(),
        title: `Weather for ${title} tomorrow`,
        body: `${f.weather.join(', ')}.`,
        url: '/home',
      });
    }

    if (f.next && f.next.verdict !== 'ok') {
      const morning = moment(f.start).hour(8).startOf('hour');
      add({
        id: `buffer:${f.id}`,
        // Events before 8:00 get their warning the evening before
        at: (morning.isBefore(f.start) ? morning : morning.subtract(13, 'hours')).valueOf(),
        title: f.next.verdict === 'late' ? `Not enough time to get to ${f.next.title}` : `Tight gap before ${f.next.title}`,
        body: `${f.next.minutes} min drive after ${title}, with ${f.next.gap} min between them.`,
        url: '/home',
      });
    }
  }

  return alerts.sort((a, b) => a.at - b.at);
}

/** Reminders are sent for this far ahead; the server keeps alerts up to 8 days out */
const REMINDER_DAYS = 7;

/** The events' own Google reminders, as notifications */
export function reminderAlerts(events: Event[], now = new Date()): Alert[] {
  const until = moment(now).add(REMINDER_DAYS, 'days').valueOf();
  const alerts = new Map<string, Alert>();
  for (const event of events) {
    const allDay = event.startMoment.format('HH:mm') === '00:00' && event.endMoment.format('HH:mm') === '00:00';
    for (const minutes of event.reminders ?? []) {
      const at = event.startMoment.valueOf() - minutes * 60_000;
      if (at <= now.getTime() || at > until) continue;
      const when = allDay
        ? event.startMoment.format('dddd D MMMM')
        : minutes === 0
          ? `Starting now, ${event.startMoment.format('HH:mm')}`
          : `Starts ${event.startMoment.from(at)}, at ${event.startMoment.format('HH:mm')}`;
      const id = `remind:${event.id}:${minutes}`;
      alerts.set(id, {
        id,
        at,
        title: event.title || '(No title)',
        body: [when, event.location?.trim()].filter(Boolean).join(' · '),
        url: '/home',
      });
    }
  }
  return [...alerts.values()].sort((a, b) => a.at - b.at);
}
