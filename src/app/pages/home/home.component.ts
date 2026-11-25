import { ChangeDetectorRef, Component, HostListener, NgZone, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import moment from 'moment';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCalendarDay,
  faCalendarPlus,
  faChevronLeft,
  faChevronRight,
  faChartSimple,
  faComments,
  faCog,
  faEllipsis,
  faKeyboard,
  faMagnifyingGlass,
  faSignOutAlt,
  faUmbrellaBeach,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Day, Month } from '../../interfaces/month.interface';
import { DayHover, MonthComponent } from './month/month.component';
import { GoogleCalendarEvent, GoogleCalendar } from '../../services/google/calendar.service';
import { Event, EventDisplayDetails } from '../../interfaces/event.interface';
import { CalendarService } from '../../services/api/calendar.service';
import { Settings, SettingsService } from '../../services/settings.service';
import { WindowContainerComponent } from '../../windows/window-container/window-container.component';
import { WindowsService } from '../../windows/windows.service';
import { EventsListParameters } from '../../windows/events-list/events-list.component';
import { EditEventParameters } from '../../windows/event-edit/event-edit.component';
import { UtilService } from '../../services/util.service';
import { AuthService } from '../../services/api/auth.service';
import { UserService } from '../../services/api/user.service';
import { bucketEventsByDay, dayKey } from './events-by-day';
import { withViewTransition } from '../../view-transition';
import { DatePickerComponent } from '../../shared/date-picker/date-picker.component';
import { SyncService } from '../../services/sync.service';
import { FeaturesService } from '../../services/features.service';
import { YearReviewParameters } from '../../windows/year-review/year-review.component';
import { AskCalendarParameters } from '../../windows/ask-calendar/ask-calendar.component';
import { SearchCommand, SearchComponent } from './search/search.component';
import { CountdownsService } from '../../services/countdowns.service';
import { Pin, countdown } from '../../features/countdowns';
import { canEditEvent } from '../../services/util.service';

const TEMP_EVENT_ID = 'temp-id';
// Per browser tab: a reload (or coming back from settings) keeps the year, a new tab starts at today
const YEAR_KEY = 'yearly.year';

function savedYear(): number | null {
  const year = Number(sessionStorage.getItem(YEAR_KEY));
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
}

@Component({
  selector: 'app-home',
  imports: [FontAwesomeModule, RouterLink, MonthComponent, WindowContainerComponent, DatePickerComponent, SearchComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  // FontAwesome icons
  chevronLeftIcon = faChevronLeft;
  chevronRightIcon = faChevronRight;
  cogIcon = faCog;
  exitIcon = faSignOutAlt;
  addEventIcon = faCalendarPlus;
  leaveIcon = faUmbrellaBeach;
  reviewIcon = faChartSimple;
  typeIcon = faKeyboard;
  moreIcon = faEllipsis;
  askIcon = faComments;
  searchIcon = faMagnifyingGlass;
  closeIcon = faXmark;
  todayIcon = faCalendarDay;

  isLoading = true;

  settings: Settings = {
    calendars: [],
  };

  currentYear = new Date().getFullYear();
  year: number = savedYear() ?? this.currentYear;
  months: Month[] = [];

  /** Raw events of the displayed year; eventsByDay is derived from it */
  private events: Event[] = [];
  // shortcut: lives as long as this page, so returning from settings refetches; fine while settings can change what is shown
  private yearCache = new Map<number, Event[]>();
  eventsByDay = new Map<string, Event[]>();

  calendars: GoogleCalendar[] = [];

  newEventStart: Date | null = null;

  /** Hover preview of a day's events (pointer devices only) */
  preview: { day: Day; events: Event[]; left: number; top: number; above: boolean } | null = null;
  private readonly canHover = matchMedia('(hover: hover)').matches;

  constructor(
    public authService: AuthService,
    public calendarService: CalendarService,
    private settingsService: SettingsService,
    public windowsService: WindowsService,
    private utilService: UtilService,
    private userService: UserService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private sync: SyncService,
    public features: FeaturesService,
    public countdowns: CountdownsService,
    private router: Router
  ) {
    this.buildMonths();
  }

  async ngOnInit() {
    this.sync.start();
    this.settings = this.settingsService.getSettings();
    this.countdowns.reload();

    this.calendars = await this.calendarService.getCalendars();
    this.loadEventsIntoCalendars();
  }

  onDayHover(hover: DayHover | null) {
    if (this.drag) return;
    this.growEventLines(this.canHover && !this.calendarService.isAddingEvent ? hover?.events ?? [] : []);
    if (!hover || !this.canHover || this.calendarService.isAddingEvent || this.windowsService.anyWindowOpen()) {
      this.preview = null;
      return;
    }
    const rect = hover.element.getBoundingClientRect();
    const width = 256; // matches .preview width in CSS
    const estimatedHeight = 52 + Math.min(hover.events.length, 5) * 30;
    const above = rect.bottom + 8 + estimatedHeight > innerHeight;
    this.preview = {
      day: hover.day,
      events: [...hover.events].sort((a, b) => a.startMoment.valueOf() - b.startMoment.valueOf()),
      left: Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 8), innerWidth - width - 8),
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    };
  }

  private grownLines: Element[] = [];

  /** Grows every day's line of these events, so a multi-day event grows as a whole.
   *  Done on the DOM: re-rendering ~365 day cells on every hover would be wasteful. */
  private growEventLines(events: Event[]) {
    this.grownLines.forEach((line) => line.classList.remove('grow'));
    this.grownLines = events.flatMap((event) =>
      Array.from(document.querySelectorAll(`.line[data-event="${CSS.escape(event.id)}"]`))
    );
    this.grownLines.forEach((line) => line.classList.add('grow'));
  }

  /** Shows the year of `value` (YYYY-MM-DD), then pulses and focuses that day */
  jumpTo(value: string) {
    const date = moment(value, 'YYYY-MM-DD', true);
    if (!date.isValid()) return;

    const highlight = () => {
      const day = document.getElementById(`day-${date.date()}-${date.month()}-${date.year()}`);
      day?.scrollIntoView({ block: 'center', behavior: 'smooth' }); // phones scroll; no-op when it all fits
      day?.focus({ preventScroll: true });
      day?.animate(
        [
          { boxShadow: '0 0 0 0 rgb(37 99 235 / 0.55)' },
          { boxShadow: '0 0 0 8px rgb(37 99 235 / 0)' },
        ],
        { duration: 800, iterations: 3, easing: 'ease-out' }
      );
    };

    if (date.year() === this.year) highlight();
    else this.changeYear(date.year()).then(highlight);
  }

  previewTime(event: Event): string {
    const time = (m: moment.Moment) => m.format('HH:mm');
    const allDay = time(event.startMoment) === '00:00' && time(event.endMoment) === '00:00';
    if (allDay || (!event.isFirstDay && !event.isLastDay)) return 'All day';
    if (event.isFirstDay && event.isLastDay) return `${time(event.startMoment)} – ${time(event.endMoment)}`;
    return event.isFirstDay ? `From ${time(event.startMoment)}` : `Until ${time(event.endMoment)}`;
  }

  ngAfterViewInit() {
    // Phones scroll through the months: start at today
    if (matchMedia('(max-width: 768px), (max-height: 500px)').matches)
      document.querySelector('app-day .today')?.scrollIntoView({ block: 'center' });

    // Scrolls come from whichever element scrolls, so listen in the capture phase; outside Angular so scrolling doesn't re-render
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.checkToday());
    };
    this.ngZone.runOutsideAngular(() => {
      addEventListener('scroll', onScroll, { capture: true, passive: true });
      addEventListener('resize', onScroll);
    });
    this.stopWatchingToday = () => {
      removeEventListener('scroll', onScroll, { capture: true });
      removeEventListener('resize', onScroll);
    };
    this.checkToday();
  }

  ngOnDestroy() {
    this.stopWatchingToday?.();
  }

  /** Whether today's square is on screen (below the top bar); the Today button turns on when it isn't */
  todayInView = true;
  private stopWatchingToday?: () => void;

  goToToday() {
    this.jumpTo(moment().format('YYYY-MM-DD'));
  }

  private checkToday() {
    const rect = document.querySelector('app-day .today')?.getBoundingClientRect();
    const top = document.querySelector('app-home .topbar')?.getBoundingClientRect().bottom ?? 0;
    const inView = rect != null && rect.bottom > top && rect.top < innerHeight;
    if (inView !== this.todayInView) this.ngZone.run(() => (this.todayInView = inView));
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent) {
    // Escape in a dropdown, date picker or search only closes that
    if ((event.target as Element)?.closest?.('select, [popover], dialog')) return;
    // TODO: settings #6
    this.windowsService.backAllWindows();
  }

  buildMonths() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' });
    const dayLabel = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    this.months = Array.from({ length: 12 }, (_, monthNumber) => {
      const days: Day[] = [];
      const date = new Date(this.year, monthNumber, 1);
      for (; date.getMonth() === monthNumber; date.setDate(date.getDate() + 1)) {
        const day = new Date(date);
        days.push({
          iso: moment(day).format('YYYY-MM-DD'),
          number: day.getDate(),
          weekDay: (day.getDay() + 6) % 7,
          date: day,
          key: dayKey(day),
          label: dayLabel.format(day),
          isToday: day.getTime() === today.getTime(),
          isPast: day < today,
        });
      }
      return {
        name: monthName.format(new Date(this.year, monthNumber, 1)),
        number: monthNumber,
        isCurrent: this.year === today.getFullYear() && monthNumber === today.getMonth(),
        days,
      };
    });
  }

  isEventDeclined(event: GoogleCalendarEvent): boolean {
    return event.attendees?.some((a) => a.self && a.responseStatus === 'declined') ?? false;
  }

  private setEvents(events: Event[]) {
    this.events = events;
    // Keep local edits when coming back to this year
    this.yearCache.set(this.year, events);
    this.eventsByDay = bucketEventsByDay(events, this.year);
    if (!this.drag) this.countdowns.refresh(events);
    this.updateBadge();
  }

  /** Today's number of events on the installed app's icon */
  // shortcut: only updates while Yearly is open, so the count can be a day old; phase 5 push could refresh it
  private updateBadge() {
    if (!('setAppBadge' in navigator)) return;
    if (!this.features.isOn('app-badge')) {
      navigator.clearAppBadge().catch(() => {});
      return;
    }
    if (this.year !== this.currentYear) return;
    const today = (this.eventsByDay.get(dayKey(new Date())) ?? []).filter(
      (e) => e.id !== TEMP_EVENT_ID && e.eventType !== 'workingLocation'
    ).length;
    (today ? navigator.setAppBadge(today) : navigator.clearAppBadge()).catch(() => {});
  }

  addEventsToCalendar(events: Event[]) {
    this.setEvents([...this.events, ...events]);
  }

  removeEventsFromCalendar(eventsId: string[]): void {
    this.setEvents(this.events.filter((event) => !eventsId.includes(event.id)));
  }

  /** Fetches every enabled calendar's events for a year, in parallel */
  private fetchYear(year: number): Promise<Event[]> {
    return this.fetchRange(new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59));
  }

  /** Fetches every enabled calendar's events in a date range, in parallel, with the same filters as the calendar */
  private async fetchRange(start: Date, end: Date): Promise<Event[]> {
    const perCalendar = await Promise.all(
      this.calendars
        .filter(
          (calendar) =>
            this.settings.calendars.find((cal) => cal.id === calendar.id)?.allowed ?? false
        )
        .map((calendar) => this.fetchCalendarEvents(calendar, start, end))
    );
    return perCalendar.flat();
  }

  private async fetchCalendarEvents(
    calendar: GoogleCalendar,
    start: Date,
    end: Date
  ): Promise<Event[]> {
    try {
      const calendarSettings = this.settings.calendars.find((cal) => cal.id === calendar.id);

      // The colour palette is cached and shared, so it loads alongside the events
      const [googleEvents, eventColours] = await Promise.all([
        this.calendarService.getEvents(start, end, calendar.id),
        this.calendarService.getEventColours(),
      ]);

      return googleEvents
        // remove recurring and declined events
        .filter(
          (event) =>
            (event.recurringEventId == null ||
              (calendarSettings?.allowRecurring && // Show recurring if enabled
                (event.eventType != 'birthday' || calendarSettings?.allowBirthdays))) && // Show birthdays if enabled (birthdays are recurring)
            (calendarSettings?.showDeclinedEvents || !this.isEventDeclined(event))
        )
        .map((event) =>
          this.utilService.googleEventToEvent(
            event,
            (event.colorId && eventColours[event.colorId]) || calendar.backgroundColor,
            calendar.id
          )
        );
    } catch (e) {
      console.log(e);
      return [];
    }
  }

  /** Shows the year from cache straight away, then refreshes it and prefetches its neighbours */
  async loadEventsIntoCalendars() {
    const year = this.year;
    this.setEvents(this.yearCache.get(year) ?? []);
    this.isLoading = true;
    try {
      const events = await this.fetchYear(year);
      this.yearCache.set(year, events);
      if (year === this.year) this.setEvents(events);
    } finally {
      if (year === this.year) this.isLoading = false;
    }

    for (const neighbour of [year - 1, year + 1]) {
      if (!this.yearCache.has(neighbour))
        this.fetchYear(neighbour).then((events) => {
          if (!this.yearCache.has(neighbour)) this.yearCache.set(neighbour, events);
        });
    }
  }

  changeYear(newYear: number): Promise<void> {
    const direction = newYear > this.year ? 'next' : newYear < this.year ? 'prev' : '';
    return withViewTransition(
      this.ngZone,
      () => {
        this.preview = null;
        // A picked start day survives the year change, so events can span years (the end is picked in the new year)
        this.year = newYear;
        sessionStorage.setItem(YEAR_KEY, String(newYear));
        this.buildMonths();
        this.loadEventsIntoCalendars();
        this.cdr.detectChanges();
      },
      direction
    ).then(() => this.checkToday());
  }

  toggleAddEvent() {
    this.calendarService.isAddingEvent = !this.calendarService.isAddingEvent;
    if (!this.calendarService.isAddingEvent) this.cancelNewEvent();
  }

  private cancelNewEvent() {
    this.newEventStart = null;
    this.removeEventsFromCalendar([TEMP_EVENT_ID]);
  }

  private tempEvent(start: Date, end: Date): EventDisplayDetails {
    const calendar = this.calendars.find((c) => c.primary) ?? this.calendars[0];
    return {
      id: TEMP_EVENT_ID,
      title: '',
      colour: calendar?.backgroundColor ?? '#2563eb',
      eventType: 'default',
      creator: { email: this.userService.emailAddress },
      calendarId: calendar?.id,
      startMoment: moment(start),
      endMoment: moment(end),
      canEdit: true,
    } as EventDisplayDetails;
  }

  onDayClickEvent({
    date,
    events,
    mouseEvent,
  }: {
    date: Date;
    events: Event[];
    mouseEvent: MouseEvent;
  }) {
    this.preview = null;
    // If user clicks on the left side of the screen, open the window on the right side and vice versa
    const side = mouseEvent.clientX < window.innerWidth / 2 ? 'right' : 'left';

    if (this.calendarService.isAddingEvent) {
      this.pickNewEventDay(date, side);
      return;
    }

    if (events?.length > 0) {
      const parameters: EventsListParameters = {
        events,
        date,
        onEventUpdated: (updated) =>
          this.setEvents([...this.events.filter((event) => event.id !== updated.id), updated]),
      };
      this.windowsService.openWindow(
        'list-events',
        parameters,
        side,
        async (
          {
            deletedEvents,
            updatedEvents,
          }: {
            deletedEvents: Event[];
            updatedEvents: Event[];
          } = { deletedEvents: [], updatedEvents: [] }
        ) => {
          // Reflect changes in the calendar
          const changedIds = [...deletedEvents, ...updatedEvents].map((event) => event.id);
          if (changedIds.length > 0) {
            this.setEvents([
              ...this.events.filter((event) => !changedIds.includes(event.id)),
              ...updatedEvents,
            ]);
          }
        }
      );
    }
  }

  private pickNewEventDay(date: Date, side: 'left' | 'right') {
    if (this.newEventStart == null) {
      this.newEventStart = date;
      // Show the picked start day straight away
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const nextDay = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
      this.addEventsToCalendar([this.tempEvent(dayStart, nextDay)]);
      return;
    }

    let start = new Date(this.newEventStart);
    let end = new Date(date);
    if (end < start) [start, end] = [end, start];

    if (start.toDateString() !== end.toDateString()) {
      // Full day events end at midnight of the next day
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
    } else {
      // Add one hour to the end time for practicality
      end.setHours(end.getHours() + 1);
    }

    const newEvent = this.tempEvent(start, end);
    this.removeEventsFromCalendar([TEMP_EVENT_ID]);
    this.addEventsToCalendar([newEvent]);
    this.openNewEvent(newEvent, side);
  }

  /** Skips picking days: opens a new event with the plain-text box focused */
  typeNewEvent() {
    this.cancelNewEvent();
    this.calendarService.isAddingEvent = false;
    const start = moment().add(1, 'hour').startOf('hour');
    this.openNewEvent(this.tempEvent(start.toDate(), start.clone().add(1, 'hour').toDate()), 'right', true);
  }

  private openNewEvent(newEvent: EventDisplayDetails, side: 'left' | 'right', focusQuickAdd = false) {
    const cleanUp = () => this.cancelNewEvent();
    this.windowsService.openWindow(
      'edit-event',
      { event: newEvent, isNewEvent: true, focusQuickAdd } as EditEventParameters,
      side,
      (createdEvent: Event) => {
        cleanUp();
        if (createdEvent) this.addEventsToCalendar([createdEvent]);
      },
      cleanUp
    );
  }

  // ---- Quick search ----

  @ViewChild(SearchComponent) private search?: SearchComponent;

  @HostListener('document:keydown', ['$event'])
  onShortcut(event: KeyboardEvent) {
    const typing = (event.target as Element)?.closest?.('input, textarea, select, [contenteditable], dialog');
    const ctrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (!ctrlK && (event.key !== '/' || typing)) return;
    if (!this.features.isOn('search') || this.windowsService.anyWindowOpen()) return;
    event.preventDefault();
    this.openSearch();
  }

  /** Searches every year loaded so far: the one on screen and the neighbours fetched alongside it */
  openSearch() {
    this.preview = null;
    const years = [...this.yearCache.keys()].sort((a, b) => a - b);
    const events = years.flatMap((year) => this.yearCache.get(year)!).filter((e) => e.id !== TEMP_EVENT_ID);
    const on = (id: string) => this.features.isOn(id);
    const commands: SearchCommand[] = [
      { label: 'Today', icon: this.todayIcon, run: () => this.goToToday() },
      { label: 'New event', icon: this.addEventIcon, run: () => this.calendarService.isAddingEvent || this.toggleAddEvent() },
      ...(on('text-events') ? [{ label: 'Type a new event', icon: this.typeIcon, run: () => this.typeNewEvent() }] : []),
      ...(on('ask-calendar') ? [{ label: 'Ask your calendar', icon: this.askIcon, run: () => this.openAskCalendar() }] : []),
      ...(on('leave-planner') ? [{ label: 'Leave planner', icon: this.leaveIcon, run: () => this.openLeavePlanner() }] : []),
      ...(on('year-review') ? [{ label: 'Year in review', icon: this.reviewIcon, run: () => this.openYearReview() }] : []),
      { label: 'Settings', icon: this.cogIcon, run: () => this.router.navigate(['/settings']) },
    ];
    const span = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0] ?? this.year);
    this.search?.open(events, commands, span);
  }

  // ---- Countdowns ----

  countdownLabel(pin: Pin): string {
    return countdown(pin);
  }

  jumpToPin(pin: Pin) {
    this.jumpTo(moment(pin.start).format('YYYY-MM-DD'));
  }

  // ---- Dragging on the grid (mouse and pen) ----

  /** In progress: from an event moves it, from an empty day creates one */
  private drag: { from: string; to: string; event?: Event; before: Event[] } | null = null;
  dragging = false;
  notice: { text: string; undo?: () => void } | null = null;
  private noticeTimer = 0;

  // shortcut: touch drags keep scrolling the page, so phones still tap to pick days; add a long-press drag if wanted
  onGridPointerDown(down: PointerEvent) {
    if (down.button !== 0 || down.pointerType === 'touch' || !this.features.isOn('drag-events')) return;
    if (this.windowsService.anyWindowOpen()) return;
    const from = this.dateAt(down.target);
    if (!from) return;

    let event: Event | undefined;
    if (this.calendarService.isAddingEvent) {
      if (this.newEventStart) return; // halfway through picking days by clicking
    } else {
      const dayEvents = this.eventsByDay.get(dayKey(moment(from).toDate())) ?? [];
      const movable = dayEvents.filter((e) => canEditEvent(e, this.userService.emailAddress));
      const lineId = (down.target as HTMLElement).closest<HTMLElement>('.line')?.dataset['event'];
      const picked = movable.find((e) => e.id === lineId) ?? (dayEvents.length === 1 ? movable[0] : undefined);
      // Several events and no line grabbed: a click lists them
      if (!picked && dayEvents.length) return;
      event = picked && this.events.find((e) => e.id === picked.id);
    }
    this.drag = { from, to: from, event, before: this.events };

    const move = (e: PointerEvent) => {
      const to = this.dateAt(e.target);
      if (to && this.drag && to !== this.drag.to) this.ngZone.run(() => this.dragTo(to));
    };
    const stop = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
    };
    const up = (e: PointerEvent) => {
      stop();
      this.ngZone.run(() => this.endDrag(e));
    };
    const cancel = () => {
      stop();
      this.ngZone.run(() => this.resetDrag());
    };
    this.ngZone.runOutsideAngular(() => {
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', cancel);
    });
  }

  private dateAt(target: EventTarget | null): string | null {
    return (target as Element | null)?.closest?.<HTMLElement>('[data-date]')?.dataset['date'] ?? null;
  }

  private shifted(event: Event, from: string, to: string): Event {
    const days = moment(to).diff(moment(from), 'days');
    return { ...event, startMoment: event.startMoment.clone().add(days, 'days'), endMoment: event.endMoment.clone().add(days, 'days') };
  }

  /** The days between both ends, as an all-day placeholder */
  private dragRange(): EventDisplayDetails {
    const [start, end] = [this.drag!.from, this.drag!.to].sort();
    return this.tempEvent(moment(start).toDate(), moment(end).add(1, 'day').toDate());
  }

  private dragTo(to: string) {
    const drag = this.drag!;
    drag.to = to;
    this.dragging = true;
    this.preview = null;
    this.growEventLines([]);
    const moving = drag.event;
    if (moving) this.setEvents(drag.before.map((e) => (e.id === moving.id ? this.shifted(moving, drag.from, to) : e)));
    else this.setEvents([...drag.before.filter((e) => e.id !== TEMP_EVENT_ID), this.dragRange()]);
  }

  /** Back to how it was; a release on the starting day stays a normal click */
  private resetDrag() {
    if (this.drag && this.events !== this.drag.before) this.setEvents(this.drag.before);
    this.drag = null;
    this.dragging = false;
  }

  private async endDrag(up: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.to === drag.from) return this.resetDrag();
    this.drag = null;
    this.dragging = false;
    this.countdowns.refresh(this.events);

    if (!drag.event) {
      const side = up.clientX < innerWidth / 2 ? 'right' : 'left';
      this.openNewEvent(this.events.find((e) => e.id === TEMP_EVENT_ID) as EventDisplayDetails, side);
      return;
    }

    const original = drag.event;
    const moved = this.shifted(original, drag.from, drag.to);
    const title = original.title || '(No title)';
    const put = (event: Event) => {
      this.setEvents(this.events.map((e) => (e.id === event.id ? event : e)));
      this.countdowns.refresh(this.events);
    };
    try {
      await this.calendarService.updateEvent(moved);
      this.notify(`Moved "${title}" to ${moved.startMoment.format('ddd D MMM')}`, async () => {
        put(original);
        try {
          await this.calendarService.updateEvent(original);
        } catch {
          put(moved);
          this.notify(`Couldn't undo moving "${title}".`);
        }
      });
    } catch {
      put(original);
      this.notify(`Couldn't move "${title}". Try again.`);
    }
  }

  private notify(text: string, undo?: () => void) {
    clearTimeout(this.noticeTimer);
    this.notice = { text, undo };
    this.noticeTimer = window.setTimeout(() => (this.notice = null), 6000);
  }

  undoNotice() {
    const undo = this.notice?.undo;
    this.notice = null;
    undo?.();
  }

  openLeavePlanner() {
    this.windowsService.openWindow('leave-planner', { date: new Date(this.year, 0, 1) }, 'right');
  }

  openAskCalendar() {
    const parameters: AskCalendarParameters = {
      date: new Date(this.year, 0, 1),
      events: this.events.filter((e) => e.id !== TEMP_EVENT_ID),
      // The whole history: from 2000 until two years ahead (repeating events need an end to be listed)
      loadAllEvents: () => this.fetchRange(new Date(2000, 0, 1), new Date(new Date().getFullYear() + 2, 11, 31, 23, 59, 59)),
      calendars: this.calendars.map((c) => ({ id: c.id, name: this.calendarService.getCalendarName(c), colour: c.backgroundColor })),
    };
    this.windowsService.openWindow('ask-calendar', parameters, 'right');
  }

  openYearReview() {
    const own = new Set(
      this.calendars.filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer').map((c) => c.id)
    );
    const events = this.events.filter((e) => e.id !== TEMP_EVENT_ID && own.has(e.calendarId));
    const calendars = this.calendars
      .filter((c) => own.has(c.id))
      .map((c) => ({ id: c.id, name: this.calendarService.getCalendarName(c), colour: c.backgroundColor }));
    const parameters: YearReviewParameters = {
      date: new Date(this.year, 0, 1),
      events,
      calendars,
      onPickDay: (date) => {
        // Close the review and pulse that day in the calendar
        this.windowsService.backAllWindows();
        this.jumpTo(date);
      },
    };
    this.windowsService.openWindow('year-review', parameters, 'right');
  }
}
