import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPaperPlane, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';
import { ASK_EVENT_LIMIT, ASK_THREAD_KEY, AskTurn, answerLocally, nearestEvents, pickEvents } from '../../features/ask';
import { IntegrationsService } from '../../services/integrations.service';
import { CalendarInfo } from '../../features/year-review';
import { Event } from '../../interfaces/event.interface';
import { LiveService } from '../../services/live.service';
import { WindowParameters, WindowsService } from '../windows.service';

export interface AskCalendarParameters extends WindowParameters {
  /** The events on screen, used if the full history can't be loaded */
  events: Event[];
  calendars: CalendarInfo[];
  /** Every enabled calendar's events, from 2000 to two years ahead */
  loadAllEvents: () => Promise<Event[]>;
}

@Component({
  selector: 'app-ask-calendar',
  imports: [FormsModule, FontAwesomeModule],
  templateUrl: './ask-calendar.component.html',
  styleUrl: './ask-calendar.component.css',
})
export class AskCalendarComponent {
  closeIcon = faXmark;
  sendIcon = faPaperPlane;
  clearIcon = faTrashCan;

  parameters: AskCalendarParameters;
  /** What Gemini gets; null while loading */
  events: Event[] | null = null;
  /** e.g. "3,000 events, Mar 2019 – Dec 2028 (the 3,000 nearest to today)" */
  coverage = '';
  question = '';
  /** Questions and answers so far, newest last; answered ones are kept between visits */
  thread: { question: string; answer?: string; error?: string; note?: string }[] = this.loadThread();

  /** Set after Gemini reports its daily free limit; the chat stays readable but nothing more is sent */
  get limitReached() {
    return this.integrations.usage('gemini').limitReached;
  }
  isAsking = false;

  suggestions = ['When is my next free weekend?', 'When did I last go to the dentist?', "What's on next week?"];

  constructor(
    public windowsService: WindowsService,
    private live: LiveService,
    private integrations: IntegrationsService
  ) {
    this.parameters = this.windowsService.getOpenedWindow()?.parameters as AskCalendarParameters;
  }

  async ngOnInit() {
    document.getElementById('ask-input')?.focus();
    this.scrollToLatest();
    let all: Event[];
    let fallback = false;
    try {
      all = await this.parameters.loadAllEvents();
    } catch {
      all = this.parameters.events;
      fallback = true;
    }
    this.events = nearestEvents(all);
    this.coverage = this.describeCoverage(all.length, fallback);
  }

  async ask(question = this.question) {
    question = question.trim();
    if (!question || this.isAsking || this.events == null) return;
    this.question = '';
    const history = this.answered();
    const entry: (typeof this.thread)[number] = { question };
    this.thread.push(entry);
    this.isAsking = true;
    try {
      const local = answerLocally(question, this.events);
      if (local != null) {
        entry.answer = local;
        entry.note = 'Answered on this device';
      } else if (this.limitReached) {
        throw `Gemini's free limit is used up for today, so this question wasn't sent.`;
      } else {
        const picked = pickEvents(question, this.events);
        entry.answer = await this.live.ask(question, picked, this.parameters.calendars, history);
        entry.note = `Sent ${picked.length.toLocaleString()} ${picked.length === 1 ? 'event' : 'events'} to Gemini`;
      }
      localStorage.setItem(ASK_THREAD_KEY, JSON.stringify(this.answered()));
    } catch (message) {
      entry.error = String(message);
    } finally {
      this.isAsking = false;
      this.scrollToLatest();
    }
  }

  private scrollToLatest() {
    setTimeout(() => document.querySelector('app-ask-calendar .thread > :last-child')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  clear() {
    this.thread = [];
    localStorage.removeItem(ASK_THREAD_KEY);
    document.getElementById('ask-input')?.focus();
  }

  private answered(): AskTurn[] {
    return this.thread.filter((t): t is AskTurn => !!t.answer).map(({ question, answer }) => ({ question, answer }));
  }

  private loadThread(): AskTurn[] {
    try {
      return JSON.parse(localStorage.getItem(ASK_THREAD_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private describeCoverage(total: number, fallback: boolean) {
    const events = this.events!;
    if (!events.length) return 'No events to ask about.';
    const times = events.map((e) => e.startMoment.valueOf());
    const range = `${moment(Math.min(...times)).format('MMM YYYY')} – ${moment(Math.max(...times)).format('MMM YYYY')}`;
    const count = `Searches ${events.length.toLocaleString()} events, ${range}`;
    if (fallback) return `${count} (only the year on screen: the full calendar couldn't be loaded)`;
    return total > ASK_EVENT_LIMIT ? `${count}: the ${ASK_EVENT_LIMIT.toLocaleString()} nearest to today, out of ${total.toLocaleString()}` : count;
  }
}
