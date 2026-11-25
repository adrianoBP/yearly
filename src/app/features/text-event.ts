import * as chrono from 'chrono-node';

export interface ParsedEvent {
  title: string;
  start: Date;
  /** All-day events end at midnight after the last day, like Google */
  end: Date;
  allDay: boolean;
  location?: string;
}

/** "dinner Friday 8pm at Rosie's" → title, start/end and location; null when there's no date in it */
export function parseEventText(text: string, ref = new Date(), locale = navigator.language): ParsedEvent | null {
  // US writes 11/28 for 28 November; everyone else day first
  const parser = locale === 'en-US' ? chrono.en.casual : chrono.en.GB;
  const [result] = parser.parse(text, ref, { forwardDate: true });
  if (!result) return null;

  let rest = `${text.slice(0, result.index)} ${text.slice(result.index + result.text.length)}`;
  let location: string | undefined;
  const at = rest.match(/\s(?:at|@)\s+(.+?)\s*$/i);
  if (at) {
    location = at[1];
    rest = rest.slice(0, at.index);
  }
  const title = rest.replace(/\s+/g, ' ').replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '');

  const allDay = !result.start.isCertain('hour');
  const start = result.start.date();
  let end: Date;
  if (allDay) {
    start.setHours(0, 0, 0, 0);
    end = result.end ? result.end.date() : new Date(start);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
  } else {
    end = result.end?.date() ?? new Date(start.getTime() + 60 * 60 * 1000);
  }

  return { title: title.charAt(0).toUpperCase() + title.slice(1), start, end, allDay, location };
}
