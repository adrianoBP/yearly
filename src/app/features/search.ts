import * as chrono from 'chrono-node';
import moment from 'moment';
import { Event } from '../interfaces/event.interface';

export const SEARCH_LIMIT = 20;

/** Events whose title or place contains every word of the query: upcoming ones first (soonest), then past ones (latest) */
export function searchEvents(query: string, events: Event[], now = moment()): Event[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>(); // an event spanning New Year is loaded with both years
  const found = events.filter((e) => {
    const text = `${e.title ?? ''} ${e.location ?? ''}`.toLowerCase();
    if (seen.has(e.id) || !words.every((word) => text.includes(word))) return false;
    seen.add(e.id);
    return true;
  });
  const upcoming = found.filter((e) => e.endMoment.isAfter(now)).sort((a, b) => a.startMoment.valueOf() - b.startMoment.valueOf());
  const past = found.filter((e) => !e.endMoment.isAfter(now)).sort((a, b) => b.startMoment.valueOf() - a.startMoment.valueOf());
  return [...upcoming, ...past].slice(0, SEARCH_LIMIT);
}

/** "5 dec", "next friday", "march 2027" → that day; null unless the whole query is a date */
export function dateQuery(query: string, today = new Date(), locale = navigator.language): Date | null {
  const text = query.trim();
  const parser = locale === 'en-US' ? chrono.en.casual : chrono.en.GB;
  const [result] = parser.parse(text, today, { forwardDate: true });
  return result && result.index === 0 && result.text.length === text.length ? result.start.date() : null;
}
