import moment from 'moment';

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

/** Nager.Date's public holiday shape */
export interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  global: boolean;
  counties: string[] | null;
}

export interface Bridge {
  /** First and last day off, YYYY-MM-DD */
  start: string;
  end: string;
  /** Working days to book as leave */
  leaveDays: string[];
  totalDays: number;
  holidays: Holiday[];
}

/** Holidays for the whole country, plus those of the chosen region (e.g. GB-SCT) */
export function holidaysFor(all: NagerHoliday[], region: string | null): Holiday[] {
  const seen = new Set<string>();
  return all
    .filter((h) => h.global || (region != null && h.counties?.includes(region)))
    .filter((h) => !seen.has(h.date) && !!seen.add(h.date))
    .map((h) => ({ date: h.date, name: h.localName || h.name }));
}

/**
 * Stretches of time off made by joining weekends and holidays with a few days of leave.
 * Picked best value first (days off per day of leave) without overlaps, returned in date order.
 */
export function findBridges(year: number, holidays: Holiday[], maxLeave = 4): Bridge[] {
  const holidayOn = new Map(holidays.map((h) => [h.date, h]));
  const days: { date: string; off: boolean }[] = [];
  for (const d = moment([year, 0, 1]); d.year() === year; d.add(1, 'day')) {
    const date = d.format('YYYY-MM-DD');
    days.push({ date, off: d.isoWeekday() >= 6 || holidayOn.has(date) });
  }

  // Runs of consecutive days off, as [first, last] indexes
  const blocks: [number, number][] = [];
  days.forEach((day, i) => {
    if (!day.off) return;
    const last = blocks[blocks.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else blocks.push([i, i]);
  });

  const candidates: Bridge[] = [];
  for (let a = 0; a < blocks.length; a++) {
    for (let b = a + 1; b < blocks.length; b++) {
      const [first, last] = [blocks[a][0], blocks[b][1]];
      const span = days.slice(first, last + 1);
      const leaveDays = span.filter((d) => !d.off).map((d) => d.date);
      if (leaveDays.length > maxLeave) break;
      const inSpan = span.map((d) => holidayOn.get(d.date)).filter((h): h is Holiday => h != null);
      // Weekend-to-weekend needs 5 days of leave, so every bridge here leans on a holiday; keep the check for maxLeave > 4
      if (inSpan.length === 0) continue;
      candidates.push({ start: span[0].date, end: span[span.length - 1].date, leaveDays, totalDays: span.length, holidays: inSpan });
    }
  }

  const value = (b: Bridge) => b.totalDays / b.leaveDays.length;
  candidates.sort((x, y) => value(y) - value(x) || y.totalDays - x.totalDays);
  const chosen: Bridge[] = [];
  for (const bridge of candidates) {
    if (chosen.every((c) => bridge.end < c.start || bridge.start > c.end)) chosen.push(bridge);
  }
  return chosen.sort((x, y) => x.start.localeCompare(y.start));
}
