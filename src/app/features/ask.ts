import moment from 'moment';
import { Event } from '../interfaces/event.interface';
import { CalendarInfo } from './year-review';

export interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

// Used when the model list can't be read; Google suggests it for new projects (Nov 2026)
export const FALLBACK_MODEL = 'models/gemini-3.5-flash-lite';

/** Picks the newest stable "flash-lite" (or else "flash") model that can generate text; these are the free-tier ones */
export function pickModel(models: GeminiModel[]): string {
  const usable = models.filter(
    (m) =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      /flash/.test(m.name) &&
      !/preview|exp|tts|image|live|audio|embedding|thinking/.test(m.name)
  );
  const version = (name: string) => parseFloat(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  const best = (list: GeminiModel[]) => [...list].sort((a, b) => version(b.name) - version(a.name))[0]?.name;
  return best(usable.filter((m) => /flash-lite/.test(m.name))) ?? best(usable) ?? FALLBACK_MODEL;
}

/** Most events searched on the device */
export const ASK_EVENT_LIMIT = 3000;
/** Most events sent with one question (about 25 tokens each), so the free quota lasts */
export const ASK_SEND_LIMIT = 300;

const MONTH_NAMES = [...moment.months(), ...moment.monthsShort()].map((m) => m.toLowerCase());
const STOPWORDS = new Set(
  (
    'a about after an and any anything appointment are at be been before between busy calendar day days did do does doing during ' +
    'event events every for free from get go going got had has have how i in is it its last many me month months much my next ' +
    'of often on or see than that the there this time times to today tomorrow visit was week weekend weekends were what when ' +
    'where which who will with year years yesterday you your'
  ).split(' ')
);

/** Words of a question worth looking for in event titles and places */
export function keywords(question: string): string[] {
  return (question.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) ?? [])
    .map((word) => word.replace(/'s$/, ''))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word) && !MONTH_NAMES.includes(word) && !/^\d+$/.test(word));
}

function mentions(event: Event, word: string): boolean {
  const text = `${event.title ?? ''} ${event.location ?? ''}`.toLowerCase();
  return text.includes(word) || (word.length > 4 && word.endsWith('s') && text.includes(word.slice(0, -1)));
}

const overlaps = (start: moment.Moment, end: moment.Moment) => (e: Event) => e.startMoment.isBefore(end) && e.endMoment.isAfter(start);

/** The period a question is about ("next week", "in March", "2021"...), or null */
export function dateFilter(question: string, today = moment()): ((e: Event) => boolean) | null {
  const q = question.toLowerCase();
  const whole = (date: moment.Moment, unit: moment.unitOfTime.StartOf) => overlaps(date.clone().startOf(unit), date.clone().endOf(unit));

  const relative = q.match(/\b(this|next|last) (week|weekend|month|year)\b/);
  if (relative) {
    const shift = relative[1] === 'next' ? 1 : relative[1] === 'last' ? -1 : 0;
    if (relative[2] === 'weekend') {
      const saturday = today.clone().startOf('isoWeek').add(shift, 'week').add(5, 'days');
      return overlaps(saturday, saturday.clone().add(2, 'days'));
    }
    const unit = relative[2] as 'week' | 'month' | 'year';
    return whole(today.clone().add(shift, unit), unit === 'week' ? 'isoWeek' : unit);
  }

  const day = q.match(/\b(today|tomorrow|yesterday)\b/)?.[1];
  if (day) return whole(today.clone().add(day === 'tomorrow' ? 1 : day === 'yesterday' ? -1 : 0, 'day'), 'day');

  const year = q.match(/\b(19|20)\d{2}\b/)?.[0];
  const month = q.match(new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b`))?.[1];
  if (month) {
    const index = MONTH_NAMES.indexOf(month) % 12;
    if (year) return whole(moment({ year: +year, month: index, day: 1 }), 'month');
    // No year given: that month in any year
    return (e) => e.startMoment.month() === index || e.endMoment.month() === index;
  }
  if (year) return whole(moment({ year: +year, month: 0, day: 1 }), 'year');
  return null;
}

/** The events a question is about: its period plus any event naming its words; else the nearest ones */
export function pickEvents(question: string, events: Event[], today = moment()): Event[] {
  const inPeriod = dateFilter(question, today);
  const words = keywords(question);
  const picked = events.filter((e) => inPeriod?.(e) || words.some((word) => mentions(e, word)));
  return nearestEvents(picked.length ? picked : events, ASK_SEND_LIMIT, today);
}

const isAllDay = (e: Event) => e.startMoment.format('HH:mm') === '00:00' && e.endMoment.format('HH:mm') === '00:00';

export function when(e: Event, withYear: boolean): string {
  const day = withYear ? 'ddd D MMM YYYY' : 'ddd D MMM';
  if (!isAllDay(e)) return `${e.startMoment.format(day)}, ${e.startMoment.format('HH:mm')}–${e.endMoment.format('HH:mm')}`;
  const last = e.endMoment.clone().subtract(1, 'day');
  return last.isSame(e.startMoment, 'day') ? `${e.startMoment.format(day)}, all day` : `${e.startMoment.format(day)} – ${last.format(day)}`;
}

/** Answers the questions a plain search can, so they cost no Gemini quota; null for everything else */
export function answerLocally(question: string, events: Event[], today = moment()): string | null {
  const q = question.toLowerCase().trim().replace(/[?.!\s]+$/, '');

  if (/\bnext free weekend\b/.test(q)) {
    const busy = events.filter((e) => e.eventType !== 'birthday' && e.eventType !== 'workingLocation');
    const saturday = today.clone().startOf('day').isoWeekday(6);
    if (saturday.isBefore(today, 'day')) saturday.add(1, 'week'); // Sunday: this weekend is half gone
    for (let i = 0; i < 52; i++, saturday.add(1, 'week')) {
      if (!busy.some(overlaps(saturday, saturday.clone().add(2, 'days'))))
        return `${saturday.format('ddd D MMM')} – ${saturday.clone().add(1, 'day').format('ddd D MMM')} has nothing on.`;
    }
    return 'There is no completely free weekend in the next 12 months.';
  }

  const period = q.match(/^what(?:'s| is) (?:on|happening|planned) (today|tomorrow|this week|next week)$/)?.[1];
  if (period) {
    const found = events.filter(dateFilter(period, today)!).sort((a, b) => a.startMoment.valueOf() - b.startMoment.valueOf());
    return found.length ? found.map((e) => `${when(e, false)}: ${e.title || '(No title)'}`).join('\n') : `Nothing on ${period}.`;
  }

  const lastNext = q.match(/^when(?: did| is| was|'s)? (?:i |my |the )?(last|next) (.+)$/);
  if (lastNext) {
    const words = keywords(lastNext[2]);
    if (!words.length) return null;
    const matching = events.filter((e) => words.every((word) => mentions(e, word)));
    const found =
      lastNext[1] === 'last'
        ? matching.filter((e) => e.startMoment.isBefore(today)).sort((a, b) => b.startMoment.valueOf() - a.startMoment.valueOf())[0]
        : matching.filter((e) => !e.startMoment.isBefore(today)).sort((a, b) => a.startMoment.valueOf() - b.startMoment.valueOf())[0];
    // Nothing found: Gemini may still spot it under another name
    return found ? `${found.title}: ${when(found, true)}.` : null;
  }
  return null;
}

/** The events closest to today, past or future, up to the limit; the rest are the least likely to be asked about */
export function nearestEvents(events: Event[], limit = ASK_EVENT_LIMIT, today = moment()): Event[] {
  if (events.length <= limit) return events;
  const distance = (e: Event) => Math.abs(e.startMoment.diff(today));
  return [...events].sort((a, b) => distance(a) - distance(b)).slice(0, limit);
}

/** One line per event: "2026-04-03 Fri 09:00–10:00 | Dentist | 10 High St | Events" */
export function describeEvents(events: Event[], calendars: CalendarInfo[]): string {
  const calendarName = (id: string) => calendars.find((c) => c.id === id)?.name ?? '';
  return [...events]
    .sort((a, b) => a.startMoment.valueOf() - b.startMoment.valueOf())
    .map((e) => {
      const when = isAllDay(e)
        ? `${e.startMoment.format('YYYY-MM-DD ddd')} to ${e.endMoment.clone().subtract(1, 'day').format('YYYY-MM-DD ddd')} (all day)`
        : `${e.startMoment.format('YYYY-MM-DD ddd HH:mm')}–${e.endMoment.format(e.endMoment.isSame(e.startMoment, 'day') ? 'HH:mm' : 'YYYY-MM-DD HH:mm')}`;
      return [when, e.title || '(No title)', e.location ?? '', calendarName(e.calendarId)].join(' | ');
    })
    .join('\n');
}

/** Where the chat is kept, on this device only; cleared on sign-out */
export const ASK_THREAD_KEY = 'askThread';
/** Earlier questions sent along so follow-ups make sense; older ones only add tokens */
export const ASK_HISTORY_LIMIT = 3;

export interface AskTurn {
  question: string;
  answer: string;
}

/** generateContent request body */
export function buildRequest(question: string, events: Event[], calendars: CalendarInfo[], today = moment(), history: AskTurn[] = []) {
  const system = [
    'You answer questions about the user\'s own calendar, using only the events listed below.',
    `Today is ${today.format('dddd D MMMM YYYY')}. Weekends are Saturday and Sunday.`,
    'Be brief and specific: name dates like "Sat 14 Mar". If the events don\'t answer the question, say so.',
    'Answer in plain text, without Markdown.',
    '',
    'Events (date | title | place | calendar):',
    describeEvents(events, calendars) || '(no events)',
  ].join('\n');
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      ...history.slice(-ASK_HISTORY_LIMIT).flatMap((turn) => [
        { role: 'user', parts: [{ text: turn.question }] },
        { role: 'model', parts: [{ text: turn.answer }] },
      ]),
      { role: 'user', parts: [{ text: question }] },
    ],
    generationConfig: { maxOutputTokens: 600 },
  };
}

export interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export function answerText(response: GeminiResponse): string {
  if (response.promptFeedback?.blockReason) throw 'Gemini declined to answer that question.';
  const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!text) throw 'Gemini gave no answer. Try rephrasing the question.';
  return text;
}
