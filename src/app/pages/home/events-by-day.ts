import { Event } from '../../interfaces/event.interface';

export const dayKey = (date: Date) => `${date.getMonth()}-${date.getDate()}`;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Splits events into one decorated copy per day they cover within `year`, keyed by dayKey().
 * Each event gets a `lane` (row) that stays the same on every day it covers,
 * so its line is drawn continuously; each day's list is sorted by lane.
 */
export function bucketEventsByDay(events: Event[], year: number): Map<string, Event[]> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const spans = events
    .map((event) => {
      const end = event.endMoment.toDate();
      const first = startOfDay(event.startMoment.toDate());
      const last = startOfDay(end);
      // An event ending exactly at midnight doesn't occupy that day
      if (end.getTime() === last.getTime() && last > first) last.setDate(last.getDate() - 1);
      const from = first < yearStart ? yearStart : first;
      return { event, first, last, from };
    })
    .filter(({ from, last }) => from <= last && from <= yearEnd)
    // Earliest first, longer first on ties, so long events take the top lanes
    .sort((a, b) => a.from.getTime() - b.from.getTime() || b.last.getTime() - a.last.getTime());

  // Greedy lane assignment: first lane whose previous event ended before this one starts
  const laneEnds: number[] = [];
  const byDay = new Map<string, Event[]>();

  for (const { event, first, last, from } of spans) {
    let lane = laneEnds.findIndex((end) => end < from.getTime());
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = last.getTime();

    const duration = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
    const isGroupCalendar =
      event.organizer?.email?.endsWith('@group.calendar.google.com') ?? false;

    for (const day = new Date(from); day <= last && day <= yearEnd; day.setDate(day.getDate() + 1)) {
      const key = dayKey(day);
      const list = byDay.get(key) ?? [];
      list.push({
        ...event,
        isFirstDay: day.getTime() === first.getTime(),
        isLastDay: day.getTime() === last.getTime(),
        duration,
        isGroupCalendar,
        lane,
      });
      byDay.set(key, list);
    }
  }

  for (const list of byDay.values()) list.sort((a, b) => a.lane - b.lane);
  return byDay;
}
