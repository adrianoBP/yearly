import moment from 'moment';
import { Event } from '../interfaces/event.interface';
import { mergeSync } from '../services/sync';
import { findFlight } from './flight';
import { findBridges, holidaysFor } from './leave-planner';
import { parseEventText } from './text-event';
import { upcomingLocations, weatherWarnings } from './weather';
import { isTrip, tripNights, yearStats } from './year-review';
import { parseAviationstack } from './flight-status';
import { bufferVerdict, distanceKm, geohash, neighbours, routeSummary, routeTtlMs } from './travel';
import { footballCandidates, leaveBy, ticketmasterNearby } from './crowd';
import { dateQuery, searchEvents } from './search';
import { activePins, countdown } from './countdowns';
import { buildAlerts } from './alerts';
import { FALLBACK_MODEL, answerLocally, answerText, buildRequest, describeEvents, keywords, nearestEvents, pickEvents, pickModel } from './ask';

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

describe('flight status', () => {
  const response = {
    data: [
      { flight_date: '2026-11-27', flight_status: 'landed', departure: { scheduled: '2026-11-27T07:00:00+00:00' }, arrival: {} },
      {
        flight_date: '2026-11-28',
        flight_status: 'scheduled',
        departure: { iata: 'STN', terminal: '1', gate: '42', delay: 25, scheduled: '2026-11-28T07:00:00+00:00', estimated: '2026-11-28T07:25:00+00:00' },
        arrival: { iata: 'CIA', baggage: '3', scheduled: '2026-11-28T10:30:00+00:00' },
      },
    ],
  };

  it('picks the right day and reads local times as written', () => {
    const status = parseAviationstack(response, '2026-11-28')!;
    expect(status.label).toBe('Delayed 25 min');
    expect(status.tone).toBe('warn');
    expect(status.departure).toEqual(jasmine.objectContaining({ gate: '42', terminal: '1', scheduled: '07:00', estimated: '07:25' }));
    expect(status.arrival.baggage).toBe('3');
    expect(parseAviationstack(response, '2026-11-27')!.label).toBe('Landed');
  });

  it("never shows another day's flight, and surfaces API errors", () => {
    expect(parseAviationstack(response, '2026-11-29')).toBeNull();
    expect(() => parseAviationstack({ error: { message: 'Monthly limit reached.' } }, '2026-11-28')).toThrow('Monthly limit reached.');
  });
});

describe('travel', () => {
  it('measures distance and encodes geohashes', () => {
    expect(distanceKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })).toBeCloseTo(344, -1);
    expect(geohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
  });

  it('finds the timed events with a place before and after, on the same day', () => {
    const others = [
      event('Lunch', '2026-11-28T12:00', '2026-11-28T13:00', { location: 'Cafe' }),
      event('Coffee', '2026-11-28T09:00', '2026-11-28T10:00', { location: 'Bar' }),
      event('Call', '2026-11-28T14:00', '2026-11-28T14:30'),
      event('Dinner', '2026-11-28T19:00', '2026-11-28T21:00', { location: 'Rosie' }),
      event('Holiday', '2026-11-28', '2026-11-29', { location: 'Rome' }),
      event('Tomorrow', '2026-11-29T09:00', '2026-11-29T10:00', { location: 'Office' }),
    ];
    const { before, after } = neighbours(event('Gym', '2026-11-28T15:00', '2026-11-28T16:00'), others);
    expect(before?.title).toBe('Lunch');
    expect(after?.title).toBe('Dinner');
  });

  it('judges the gap against the drive', () => {
    expect(bufferVerdict(20, 35)).toBe('late');
    expect(bufferVerdict(40, 35)).toBe('tight');
    expect(bufferVerdict(60, 35)).toBe('ok');
    expect(routeSummary({ routes: [{ summary: { travelTimeInSeconds: 1530, trafficDelayInSeconds: 300, lengthInMeters: 12345 } }] })).toEqual({
      minutes: 26,
      trafficMinutes: 5,
      km: 12.3,
    });
    expect(routeSummary({})).toBeNull();
  });
});

describe('crowds', () => {
  const eventStart = new Date('2026-11-28T19:30:00Z');

  it("keeps nearby Ticketmaster events in the window, minus the user's own show", () => {
    const tm = {
      _embedded: {
        events: [
          { name: 'Hamlet', dates: { start: { dateTime: '2026-11-28T19:30:00Z' } }, _embedded: { venues: [{ name: 'Kings Theatre' }] } },
          {
            name: 'Big Concert',
            dates: { start: { dateTime: '2026-11-28T20:00:00Z' } },
            classifications: [{ segment: { name: 'Music' } }],
            _embedded: { venues: [{ name: 'Guildhall' }] },
          },
          { name: 'Matinee', dates: { start: { dateTime: '2026-11-28T14:00:00Z' } }, _embedded: { venues: [{ name: 'Guildhall' }] } },
        ],
      },
    };
    const found = ticketmasterNearby(tm, eventStart, 'Kings Theatre, Southsea Theatre night');
    expect(found.map((e) => [e.name, e.kind])).toEqual([['Big Concert', 'Music']]);
  });

  it('keeps matches in the country and window that have a venue', () => {
    const fd = {
      matches: [
        {
          utcDate: '2026-11-28T19:45:00Z',
          venue: 'Fratton Park',
          area: { code: 'ENG' },
          competition: { name: 'Championship' },
          homeTeam: { shortName: 'Portsmouth' },
          awayTeam: { shortName: 'Leeds' },
        },
        { utcDate: '2026-11-28T19:45:00Z', venue: 'San Siro', area: { code: 'ITA' }, homeTeam: { name: 'Milan' }, awayTeam: { name: 'Inter' } },
        { utcDate: '2026-11-28T12:30:00Z', venue: 'Anfield', area: { code: 'ENG' }, homeTeam: { name: 'Liverpool' }, awayTeam: { name: 'Everton' } },
        { utcDate: '2026-11-28T20:00:00Z', venue: null, area: { code: 'ENG' }, homeTeam: { name: 'A' }, awayTeam: { name: 'B' } },
      ],
    };
    expect(footballCandidates(fd, eventStart, 'GB').map((m) => m.name)).toEqual(['Portsmouth v Leeds']);
  });

  it('adds time for crowds when saying when to leave', () => {
    expect(leaveBy(eventStart, 25, false).toISOString()).toBe('2026-11-28T18:55:00.000Z');
    expect(leaveBy(eventStart, 25, true).toISOString()).toBe('2026-11-28T18:35:00.000Z');
  });
});

describe('ask your calendar', () => {
  it('picks the newest stable flash-lite model', () => {
    const models = [
      { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-4.0-flash-lite-preview', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    ];
    expect(pickModel(models)).toBe('models/gemini-3.5-flash-lite');
    expect(pickModel([models[2]])).toBe('models/gemini-3.8-flash');
    expect(pickModel([])).toBe(FALLBACK_MODEL);
  });

  it('keeps the events nearest to today when there are too many', () => {
    const today = moment('2026-11-25');
    const events = [
      event('Long ago', '2001-01-01T10:00', '2001-01-01T11:00'),
      event('Last week', '2026-11-18T10:00', '2026-11-18T11:00'),
      event('Far ahead', '2028-06-01T10:00', '2028-06-01T11:00'),
      event('Next week', '2026-12-02T10:00', '2026-12-02T11:00'),
    ];
    expect(nearestEvents(events, 2, today).map((e) => e.title).sort()).toEqual(['Last week', 'Next week']);
    expect(nearestEvents(events, 10, today).length).toBe(4);
  });

  it('sends only the events a question is about', () => {
    const today = moment('2026-11-25T12:00'); // a Wednesday
    const events = [
      event('Dentist', '2021-03-06T09:00', '2021-03-06T09:30'),
      event('Rome', '2026-12-20', '2026-12-29', { location: 'Rome' }),
      event('Football', '2026-12-01T19:00', '2026-12-01T21:00'),
      event('Lunch', '2026-11-25T13:00', '2026-11-25T14:00'),
    ];
    const titles = (question: string) => pickEvents(question, events, today).map((e) => e.title).sort();
    expect(keywords("When did I last go to the dentist's?")).toEqual(['dentist']);
    expect(titles('How often have I been to the dentist?')).toEqual(['Dentist']);
    expect(titles('Anything next week?')).toEqual(['Football']);
    expect(titles('What did I do in March 2021?')).toEqual(['Dentist']);
    expect(titles('Who am I going to Rome with in December?')).toEqual(['Football', 'Rome']);
    expect(titles('Am I a busy person?').length).toBe(4);
  });

  it('answers simple questions without Gemini', () => {
    const today = moment('2026-11-25T12:00');
    const events = [
      event('Dentist', '2026-03-06T09:00', '2026-03-06T09:30'),
      event('Party', '2026-11-28T20:00', '2026-11-28T23:00'),
      event('Football', '2026-12-01T19:00', '2026-12-01T21:00'),
      event('Mum', '2026-12-05', '2026-12-06', { eventType: 'birthday' }),
    ];
    expect(answerLocally('When is my next free weekend?', events, today)).toBe('Sat 5 Dec – Sun 6 Dec has nothing on.');
    expect(answerLocally('When did I last go to the dentist?', events, today)).toBe('Dentist: Fri 6 Mar 2026, 09:00–09:30.');
    expect(answerLocally("What's on next week?", events, today)).toBe('Tue 1 Dec, 19:00–21:00: Football\nSat 5 Dec, all day: Mum');
    expect(answerLocally("What's on tomorrow?", events, today)).toBe('Nothing on tomorrow.');
    expect(answerLocally('When is my next haircut?', events, today)).toBeNull();
    expect(answerLocally('Who is coming to the party?', events, today)).toBeNull();
  });

  it('describes events one per line and reads the answer', () => {
    const events = [event('Rome', '2026-12-20', '2026-12-29', { location: 'Rome' }), event('Dentist', '2026-03-06T09:00', '2026-03-06T09:30')];
    const lines = describeEvents(events, [{ id: 'me', name: 'Events', colour: '' }]).split('\n');
    expect(lines[0]).toBe('2026-03-06 Fri 09:00–09:30 | Dentist |  | Events');
    expect(lines[1]).toBe('2026-12-20 Sun to 2026-12-28 Mon (all day) | Rome | Rome | Events');
    const request = buildRequest('When am I in Rome?', events, [], moment('2026-11-25'));
    expect(request.systemInstruction.parts[0].text).toContain('Today is Wednesday 25 November 2026');
    expect(request.contents[0].parts[0].text).toBe('When am I in Rome?');
    const followUp = buildRequest('And after?', events, [], moment('2026-11-25'), [{ question: 'When am I in Rome?', answer: 'From Sun 20 Dec.' }]);
    expect(followUp.contents.map((c) => `${c.role}: ${c.parts[0].text}`)).toEqual(['user: When am I in Rome?', 'model: From Sun 20 Dec.', 'user: And after?']);
    expect(answerText({ candidates: [{ content: { parts: [{ text: 'From ' }, { text: 'Sun 20 Dec.' }] } }] })).toBe('From Sun 20 Dec.');
    expect(() => answerText({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow('Gemini declined to answer that question.');
  });
});

describe('searchEvents', () => {
  const now = moment(ref);
  const events = [
    event('Dentist', '2026-03-06T09:00', '2026-03-06T09:30'),
    event('Dentist check-up', '2027-01-12T10:00', '2027-01-12T10:30'),
    event('Football', '2026-12-01T19:00', '2026-12-01T21:00', { location: 'Hampden Park' }),
    event('Dentist', '2026-03-06T09:00', '2026-03-06T09:30'), // same event loaded with the next year
  ];

  it('matches every word in title or place, upcoming first, without duplicates', () => {
    expect(searchEvents('dentist', events, now).map((e) => e.startMoment.format('YYYY-MM-DD'))).toEqual(['2027-01-12', '2026-03-06']);
    expect(searchEvents('football hampden', events, now).map((e) => e.title)).toEqual(['Football']);
    expect(searchEvents('  ', events, now)).toEqual([]);
  });

  it('treats a query as a date only when all of it is one', () => {
    expect(dateQuery('5 dec', ref, 'en-GB')).toEqual(new Date(2026, 11, 5, 12));
    expect(dateQuery('dentist', ref, 'en-GB')).toBeNull();
    expect(dateQuery('dinner friday', ref, 'en-GB')).toBeNull();
  });
});

describe('countdowns', () => {
  const now = moment(ref);
  const pin = (start: string, end: string) => ({ id: start, title: 'Trip', start, end, colour: '#000' });

  it('counts calendar days to the start', () => {
    expect(countdown(pin('2026-12-18T09:00', '2026-12-20T00:00'), now)).toBe('in 23 days');
    expect(countdown(pin('2026-11-26T08:00', '2026-11-26T09:00'), now)).toBe('tomorrow');
    expect(countdown(pin('2026-11-25T18:00', '2026-11-25T19:00'), now)).toBe('today');
    expect(countdown(pin('2026-11-24T00:00', '2026-11-27T00:00'), now)).toBe('now');
  });

  it('drops ended pins and sorts the rest soonest first', () => {
    const pins = [pin('2026-12-18T09:00', '2026-12-20T00:00'), pin('2026-11-01T00:00', '2026-11-02T00:00'), pin('2026-11-30T00:00', '2026-12-01T00:00')];
    expect(activePins(pins, now).map((p) => p.start)).toEqual(['2026-11-30T00:00', '2026-12-18T09:00']);
  });
});

describe('buildAlerts', () => {
  const now = new Date(2026, 10, 25, 10); // Wed 25 Nov, 10:00
  const theatre = { id: 't', title: 'Theatre', start: new Date(2026, 10, 26, 19, 30) };
  const match = { name: 'Rangers v Celtic', venue: 'Ibrox', start: new Date(2026, 10, 26, 19, 45), kind: 'Football', distanceKm: 1.2 };

  it('warns only when something is wrong', () => {
    expect(buildAlerts([{ ...theatre, home: { minutes: 25, trafficMinutes: 2, leaveBy: new Date(2026, 10, 26, 18, 55) } }], now)).toEqual([]);
    expect(buildAlerts([{ ...theatre, weather: [] }], now)).toEqual([]);
  });

  it('says when to leave, why, and sends it 15 minutes earlier', () => {
    const [alert] = buildAlerts([{ ...theatre, crowds: [match], home: { minutes: 25, trafficMinutes: 2, leaveBy: new Date(2026, 10, 26, 18, 35) } }], now);
    expect(alert.title).toBe('Leave by 18:35 for Theatre');
    expect(alert.body).toBe('25 min drive; Rangers v Celtic is on nearby at 19:45.');
    expect(alert.at).toBe(new Date(2026, 10, 26, 18, 20).getTime());
  });

  it('falls back to a crowd warning without a home address, and warns about weather and gaps', () => {
    const alerts = buildAlerts(
      [{ ...theatre, crowds: [match], weather: ['Rain likely (80%)'], next: { title: 'Drinks', minutes: 30, gap: 20, verdict: 'late' } }],
      now
    );
    expect(alerts.map((a) => [a.id, moment(a.at).format('ddd HH:mm')])).toEqual([
      ['weather:t', 'Wed 19:00'],
      ['buffer:t', 'Thu 08:00'],
      ['crowd:t', 'Thu 17:30'],
    ]);
    expect(alerts[1].title).toBe('Not enough time to get to Drinks');
  });

  it('leaves out alerts whose time has passed', () => {
    const late = new Date(2026, 10, 25, 20);
    expect(buildAlerts([{ ...theatre, weather: ['Snow'] }], late)).toEqual([]);
  });
});

describe('upcomingLocations', () => {
  it('lists distinct places of events not yet over within the window, soonest first', () => {
    const now = moment('2026-11-26T12:00:00');
    const events = [
      event('Later', '2026-12-05T10:00', '2026-12-05T11:00', { location: 'Rome' }),
      event('Over', '2026-11-26T08:00', '2026-11-26T09:00', { location: 'Paris' }),
      event('Ongoing', '2026-11-26T11:00', '2026-11-26T13:00', { location: ' London ' }),
      event('Again', '2026-11-28T10:00', '2026-11-28T11:00', { location: 'London' }),
      event('Too far', '2026-12-20T10:00', '2026-12-20T11:00', { location: 'Oslo' }),
      event('Nowhere', '2026-11-27T10:00', '2026-11-27T11:00', { location: '  ' }),
    ];
    expect(upcomingLocations(events, now, 16, 20)).toEqual(['London', 'Rome']);
    expect(upcomingLocations(events, now, 16, 1)).toEqual(['London']);
  });
});

describe('routeTtlMs', () => {
  const MIN = 60 * 1000;
  it('reuses a driving time for a quarter of the wait, between 5 minutes and 12 hours', () => {
    expect(routeTtlMs(2 * 60 * MIN)).toBe(30 * MIN);
    expect(routeTtlMs(10 * MIN)).toBe(5 * MIN);
    expect(routeTtlMs(3 * 24 * 60 * MIN)).toBe(12 * 60 * MIN);
  });
});
