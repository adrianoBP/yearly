import moment from 'moment';
import { Event } from '../interfaces/event.interface';
import { findFlight } from './flight';

/** One bar of a chart; hint is the tooltip and table text */
export interface Bar {
  label: string;
  value: number;
  hint: string;
  /** Identity swatch shown next to the label (e.g. a calendar's colour) */
  colour?: string;
}

export interface DayCount {
  /** YYYY-MM-DD */
  date: string;
  count: number;
}

export interface CalendarInfo {
  id: string;
  name: string;
  colour: string;
}

export interface YearStats {
  events: number;
  busyDays: number;
  trips: number;
  nightsAway: number;
  flights: number;
  busiestMonth: { name: string; events: number } | null;
  busiestWeekday: string | null;
  longest: { title: string; days: number } | null;
  /** Every day of the year, for the activity heatmap */
  days: DayCount[];
  busiestDays: (DayCount & { titles: string[] })[];
  months: Bar[];
  weekdays: Bar[];
  hours: Bar[];
  lengths: Bar[];
  nightsByMonth: Bar[];
  calendars: Bar[];
  places: Bar[];
}

/** A trip: has a location and spans at least one night */
export function isTrip(event: Pick<Event, 'location' | 'startMoment' | 'endMoment'>): boolean {
  return !!event.location?.trim() && tripNights(event) >= 1;
}

export function tripNights(event: Pick<Event, 'startMoment' | 'endMoment'>): number {
  // All-day events end at midnight after the last day; that midnight isn't a night away
  const allDay = event.startMoment.format('HH:mm') === '00:00' && event.endMoment.format('HH:mm') === '00:00';
  return event.endMoment.clone().startOf('day').diff(event.startMoment.clone().startOf('day'), 'days') - (allDay ? 1 : 0);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function isAllDay(e: Event) {
  return e.startMoment.format('HH:mm') === '00:00' && e.endMoment.format('HH:mm') === '00:00' && e.endMoment.isAfter(e.startMoment);
}

/** Statistics over the year's events; callers pass only the user's own events, not holidays or shared calendars */
export function yearStats(events: Event[], year: number, calendars: CalendarInfo[] = []): YearStats {
  const inYear = events.filter((e) => e.startMoment.year() === year);
  const trips = inYear.filter(isTrip);
  const monthName = (m: number) => moment().year(year).month(m).format('MMM');
  const monthLong = (m: number) => moment().year(year).month(m).format('MMMM');

  // Events per calendar day, counting every day an event covers
  const perDay = new Map<string, Event[]>();
  for (const e of events) {
    const last = (isAllDay(e) ? e.endMoment.clone().subtract(1, 'day') : e.endMoment.clone().subtract(1, 'ms')).startOf('day');
    for (const d = e.startMoment.clone().startOf('day'); !d.isAfter(last); d.add(1, 'day')) {
      if (d.year() !== year) continue;
      const key = d.format('YYYY-MM-DD');
      perDay.set(key, [...(perDay.get(key) ?? []), e]);
    }
  }
  const days: DayCount[] = [];
  for (const d = moment([year, 0, 1]); d.year() === year; d.add(1, 'day')) {
    const key = d.format('YYYY-MM-DD');
    days.push({ date: key, count: perDay.get(key)?.length ?? 0 });
  }

  const months = Array.from({ length: 12 }, (_, m) => {
    const value = inYear.filter((e) => e.startMoment.month() === m).length;
    return { label: monthName(m), value, hint: `${monthLong(m)}: ${plural(value, 'event')}` };
  });

  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const day = moment().isoWeekday(i + 1);
    const value = inYear.filter((e) => e.startMoment.isoWeekday() === i + 1).length;
    return { label: day.format('dd'), value, hint: `${day.format('dddd')}: ${plural(value, 'event')}` };
  });

  const timed = inYear.filter((e) => !isAllDay(e));
  const hours = Array.from({ length: 12 }, (_, i) => {
    const value = timed.filter((e) => Math.floor(e.startMoment.hour() / 2) === i).length;
    const from = String(i * 2).padStart(2, '0');
    const to = String(i * 2 + 2).padStart(2, '0');
    return { label: from, value, hint: `Starting ${from}:00–${to}:00: ${plural(value, 'event')}` };
  });

  const lengthBuckets: [string, (e: Event) => boolean][] = [
    ['Under an hour', (e) => !isAllDay(e) && e.endMoment.diff(e.startMoment, 'minutes') < 60],
    ['1–3 hours', (e) => !isAllDay(e) && e.endMoment.diff(e.startMoment, 'minutes') >= 60 && e.endMoment.diff(e.startMoment, 'minutes') < 180],
    ['3+ hours', (e) => !isAllDay(e) && e.endMoment.diff(e.startMoment, 'minutes') >= 180],
    ['1 whole day', (e) => isAllDay(e) && e.endMoment.diff(e.startMoment, 'days') === 1],
    ['2–6 days', (e) => isAllDay(e) && e.endMoment.diff(e.startMoment, 'days') >= 2 && e.endMoment.diff(e.startMoment, 'days') < 7],
    ['A week or more', (e) => isAllDay(e) && e.endMoment.diff(e.startMoment, 'days') >= 7],
  ];
  const lengths = lengthBuckets.map(([label, test]) => {
    const value = inYear.filter(test).length;
    return { label, value, hint: `${label}: ${plural(value, 'event')}` };
  });

  const nights = new Array(12).fill(0);
  for (const trip of trips) {
    for (let n = 0, d = trip.startMoment.clone().startOf('day'); n < tripNights(trip); n++, d.add(1, 'day'))
      if (d.year() === year) nights[d.month()]++;
  }
  const nightsByMonth = nights.map((value, m) => ({ label: monthName(m), value, hint: `${monthLong(m)}: ${plural(value, 'night')} away` }));

  const count = <K>(keys: K[]) => {
    const counts = new Map<K, number>();
    keys.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1]);
  };

  const calendarBars = count(inYear.map((e) => e.calendarId)).map(([id, value]) => {
    const calendar = calendars.find((c) => c.id === id);
    const label = calendar?.name ?? 'Other';
    return { label, value, hint: `${label}: ${plural(value, 'event')}`, colour: calendar?.colour };
  });

  const places = count(inYear.map((e) => e.location?.split(',')[0].trim()).filter((p): p is string => !!p))
    .slice(0, 8)
    .map(([label, value]) => ({ label, value, hint: `${label}: ${plural(value, 'visit')}` }));

  const busiestMonth = [...months].sort((a, b) => b.value - a.value)[0];
  const busiestWeekday = [...weekdays].sort((a, b) => b.value - a.value)[0];
  const longest = [...inYear].sort((a, b) => b.endMoment.diff(b.startMoment) - a.endMoment.diff(a.startMoment))[0];

  return {
    events: inYear.length,
    busyDays: days.filter((d) => d.count > 0).length,
    trips: trips.length,
    nightsAway: trips.reduce((sum, trip) => sum + tripNights(trip), 0),
    flights: inYear.filter((e) => findFlight(`${e.title} ${e.description ?? ''}`)).length,
    busiestMonth: busiestMonth?.value ? { name: monthLong(months.indexOf(busiestMonth)), events: busiestMonth.value } : null,
    busiestWeekday: busiestWeekday?.value ? busiestWeekday.hint.split(':')[0] : null,
    longest: longest
      ? { title: longest.title || '(No title)', days: Math.max(1, Math.round(longest.endMoment.diff(longest.startMoment, 'days', true))) }
      : null,
    days,
    busiestDays: [...days]
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
      .slice(0, 5)
      .map((d) => ({ ...d, titles: perDay.get(d.date)!.map((e) => e.title || '(No title)') })),
    months,
    weekdays,
    hours,
    lengths,
    nightsByMonth,
    calendars: calendarBars,
    places,
  };
}
