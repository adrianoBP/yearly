import moment from 'moment';
import { Event } from '../interfaces/event.interface';
import { mergeSync } from '../services/sync';
import { findFlight } from './flight';
import { findBridges, holidaysFor } from './leave-planner';
import { parseEventText } from './text-event';
import { weatherWarnings } from './weather';
import { isTrip, tripNights, yearStats } from './year-review';

const ref = new Date(2026, 10, 25, 10); // Wed 25 Nov 2026

describe('parseEventText', () => {
  it('reads title, time and location', () => {
    const parsed = parseEventText("dinner Friday 8pm at Rosie's", ref, 'en-GB')!;
    expect(parsed.title).toBe('Dinner');
    expect(parsed.location).toBe("Rosie's");
    expect(parsed.allDay).toBeFalse();
    expect(parsed.start).toEqual(new Date(2026, 10, 27, 20));
    expect(parsed.end).toEqual(new Date(2026, 10, 27, 21));
  });

  it('makes all-day events end at midnight after the last day', () => {
    const parsed = parseEventText('Trip to Rome 20 Dec - 28 Dec', ref, 'en-GB')!;
    expect(parsed.title).toBe('Trip to Rome');
    expect(parsed.allDay).toBeTrue();
    expect(parsed.start).toEqual(new Date(2026, 11, 20));
    expect(parsed.end).toEqual(new Date(2026, 11, 29));
  });

  it('reads day-first dates outside the US, and returns null without a date', () => {
    expect(parseEventText('Theatre at Kings Theatre 3/12 7:30pm', ref, 'en-GB')!.start).toEqual(new Date(2026, 11, 3, 19, 30));
    expect(parseEventText('call mum', ref, 'en-GB')).toBeNull();
  });
});

describe('findFlight', () => {
  it('finds a known airline and airports', () => {
    const flight = findFlight('Flight to Rome FR 1234 STN → CIA')!;
    expect(flight.flight).toBe('FR 1234');
    expect(flight.airline).toBe('Ryanair');
    expect(flight.from?.name).toBe('London Stansted');
    expect(flight.to?.code).toBe('CIA');
    expect(flight.trackUrl).toBe('https://www.flightradar24.com/data/flights/fr1234');
  });

  it('ignores lower-case look-alikes unless the text says flight', () => {
    expect(findFlight('dinner at 7')).toBeNull();
    expect(findFlight('flight ba2490 home')!.flight).toBe('BA 2490');
    expect(findFlight('Room XX 12')).toBeNull();
  });
});

describe('weatherWarnings', () => {
  it('flags rain, wind, heat, cold and storms', () => {
    expect(weatherWarnings({ date: '', code: 61, max: 12, min: 5, rain: 80, wind: 20 })).toEqual(['Rain likely (80%)']);
    expect(weatherWarnings({ date: '', code: 95, max: 31, min: -6, rain: 10, wind: 55 })).toEqual([
      'Thunderstorms',
      'Strong wind (55 km/h)',
      'Hot (31°)',
      'Freezing (-6°)',
    ]);
    expect(weatherWarnings({ date: '', code: 1, max: 20, min: 10, rain: 0, wind: 10 })).toEqual([]);
  });
});

describe('leave planner', () => {
  const easter = [
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
  ];

  it('bridges Easter with four days of leave for ten days off', () => {
    const bridges = findBridges(2026, easter);
    // The week before and the week after Easter are equally good; only one can be picked
    expect(bridges.length).toBe(1);
    const [best] = bridges;
    expect(best.totalDays).toBe(10);
    expect(best.leaveDays.length).toBe(4);
    expect(best.holidays.map((h) => h.name)).toContain('Good Friday');
    expect(['2026-03-28', '2026-04-03']).toContain(best.start);
  });

  it('never returns overlapping bridges or ones without a holiday', () => {
    const bridges = findBridges(2026, [...easter, { date: '2026-12-25', name: 'Christmas' }, { date: '2026-12-28', name: 'Boxing Day (substitute)' }]);
    for (let i = 1; i < bridges.length; i++) expect(bridges[i].start > bridges[i - 1].end).toBeTrue();
    expect(bridges.every((b) => b.holidays.length > 0 && b.leaveDays.length <= 4)).toBeTrue();
  });

  it('keeps national holidays plus the chosen region only', () => {
    const all = [
      { date: '2026-01-01', localName: "New Year's Day", name: '', global: true, counties: null },
      { date: '2026-01-02', localName: '2 January', name: '', global: false, counties: ['GB-SCT'] },
    ];
    expect(holidaysFor(all, null).length).toBe(1);
    expect(holidaysFor(all, 'GB-SCT').length).toBe(2);
  });
});

const event = (title: string, start: string, end: string, extra: Partial<Event> = {}) =>
  ({ id: title, title, startMoment: moment(start), endMoment: moment(end), calendarId: 'me', ...extra }) as Event;

describe('trips', () => {
  it('counts nights for all-day and timed trips', () => {
    expect(tripNights(event('a', '2026-12-20', '2026-12-29'))).toBe(8);
    expect(tripNights(event('b', '2026-12-20T10:00', '2026-12-22T18:00'))).toBe(2);
    expect(isTrip(event('c', '2026-12-20', '2026-12-21', { location: 'Rome' }))).toBeFalse();
    expect(isTrip(event('d', '2026-12-20', '2026-12-22', { location: 'Rome' }))).toBeTrue();
  });
});

describe('yearStats', () => {
  const stats = yearStats(
    [
      event('Rome', '2026-12-20', '2026-12-29', { location: 'Rome, Italy', calendarId: 'travel' }),
      event('Flight FR 1234', '2026-12-20T10:00', '2026-12-20T12:00'),
      event('Dinner', '2026-03-06T19:00', '2026-03-06T21:00', { location: 'Rome' }),
      event('New year trip', '2025-12-30', '2026-01-03'),
      event('Old', '2025-05-01', '2025-05-02'),
    ],
    2026,
    [
      { id: 'me', name: 'Events', colour: '#b99aff' },
      { id: 'travel', name: 'Travels', colour: '#9fe1e7' },
    ]
  );

  it('summarises only the given year', () => {
    expect(stats.events).toBe(3);
    expect(stats.trips).toBe(1);
    expect(stats.nightsAway).toBe(8);
    expect(stats.flights).toBe(1);
    expect(stats.busiestMonth?.name).toBe('December');
    expect(stats.places.map((p) => [p.label, p.value])).toEqual([['Rome', 2]]);
    expect(stats.longest?.title).toBe('Rome');
  });

  it('fills the chart series', () => {
    expect(stats.days.length).toBe(365);
    // The trip from last year still marks 1–2 January as busy
    expect(stats.days[0].count).toBe(1);
    expect(stats.days.find((d) => d.date === '2026-12-20')!.count).toBe(2);
    expect(stats.busiestDays[0]).toEqual(jasmine.objectContaining({ date: '2026-12-20', count: 2 }));
    expect(stats.months.map((m) => m.value)).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
    expect(stats.weekdays.length).toBe(7);
    expect(stats.hours[5].value).toBe(1); // 10:00 flight
    expect(stats.hours[9].value).toBe(1); // 19:00 dinner
    expect(stats.lengths.find((l) => l.label === 'A week or more')!.value).toBe(1);
    expect(stats.nightsByMonth[11].value).toBe(8);
    expect(stats.calendars.map((c) => [c.label, c.value, c.colour])).toEqual([
      ['Events', 2, '#b99aff'],
      ['Travels', 1, '#9fe1e7'],
    ]);
  });
});

describe('mergeSync', () => {
  it('keeps the newest key and each device its own usage', () => {
    const local = { keys: { tomtom: { value: 'new', at: 2 }, gemini: { value: '', at: 5 } }, usage: { phone: { tomtom: { period: '2026-11-25', count: 3 } } } };
    const remote = {
      keys: { tomtom: { value: 'old', at: 1 }, gemini: { value: 'g', at: 9 }, ticketmaster: { value: 't', at: 1 } },
      usage: { phone: { tomtom: { period: '2026-11-25', count: 1 } }, laptop: { tomtom: { period: '2026-11-25', count: 7 } } },
    };
    const merged = mergeSync(local, remote, 'phone');
    expect(merged.keys.tomtom!.value).toBe('new');
    expect(merged.keys.gemini!.value).toBe('g');
    expect(merged.keys.ticketmaster!.value).toBe('t');
    expect(merged.usage['phone'].tomtom!.count).toBe(3);
    expect(merged.usage['laptop'].tomtom!.count).toBe(7);
    expect(mergeSync(local, null, 'phone').keys).toEqual(local.keys);
  });
});
