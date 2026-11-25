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

/** Keeps the request inside the free tier's tokens per minute (about 25 tokens an event) */
export const ASK_EVENT_LIMIT = 3000;

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
      const allDay = e.startMoment.format('HH:mm') === '00:00' && e.endMoment.format('HH:mm') === '00:00';
      const when = allDay
        ? `${e.startMoment.format('YYYY-MM-DD ddd')} to ${e.endMoment.clone().subtract(1, 'day').format('YYYY-MM-DD ddd')} (all day)`
        : `${e.startMoment.format('YYYY-MM-DD ddd HH:mm')}–${e.endMoment.format(e.endMoment.isSame(e.startMoment, 'day') ? 'HH:mm' : 'YYYY-MM-DD HH:mm')}`;
      return [when, e.title || '(No title)', e.location ?? '', calendarName(e.calendarId)].join(' | ');
    })
    .join('\n');
}

/** Where the chat is kept, on this device only; cleared on sign-out */
export const ASK_THREAD_KEY = 'askThread';
/** Earlier questions sent along so follow-ups make sense; older ones only add tokens */
export const ASK_HISTORY_LIMIT = 10;

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
