import { Component, Injector } from '@angular/core';
import { Day, Month, WeekDay } from '../../interfaces/month.interface';
import { CommonModule, KeyValue } from '@angular/common';
import { MonthComponent } from './month/month.component';
import { GoogleAuthService } from '../../services/google/auth.service';
import {
  GoogleCalendarColor,
  GoogleCalendarEvent,
  GoogleCalendar,
} from '../../services/google/calendar.service';
import { Event, EventExtended } from '../../interfaces/event.interface';
import moment, { Moment } from 'moment';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBan,
  faFloppyDisk,
  faDownload,
  faChevronLeft,
  faChevronRight,
  faCog,
  faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';
import { EditEventsComponent } from '../../edit-event/edit-event.component';
import { ListEventsWindowComponent } from '../../list-events-window/list-events-window.component';
import { v4 as uuidv4 } from 'uuid';
import { MockAuthService } from '../../services/mock/auth.service';
import { mockData } from '../../app.config';
import { Router } from '@angular/router';
import { CalendarService } from '../../services/calendar.service';
import { Settings, SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    MonthComponent,
    EditEventsComponent,
    ListEventsWindowComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  // FontAwesome icons
  banIcon = faBan;
  floppyDiskIcon = faFloppyDisk;
  downloadIcon = faDownload;
  chevronLeftIcon = faChevronLeft;
  chevronRightIcon = faChevronRight;
  cogIcon = faCog;
  exitIcon = faSignOutAlt;

  settings: Settings = {
    allowedCalendars: [],
  };

  currentYear = new Date().getFullYear();

  year: number = new Date().getFullYear();
  months: { [key: string]: Month } = {};

  colors: { [key: string]: GoogleCalendarColor } = {};
  calendars: GoogleCalendar[] = [];
  events: EventExtended[] = [];

  eventStart: Date | undefined;
  eventEnd: Date | undefined;
  eventsToAdd: Event[] = [];

  selectedColorId: string | undefined;

  authService: GoogleAuthService | MockAuthService;

  constructor(
    private injector: Injector,
    public router: Router,
    private calendarService: CalendarService,
    private settingsService: SettingsService
  ) {
    this.authService = mockData
      ? this.injector.get(MockAuthService)
      : this.injector.get(GoogleAuthService);

    this.buildMonths();
  }

  buildMonths() {
    this.months = {};

    const date = new Date(`${this.year}-01-01`);

    while (date.getFullYear() === this.year) {
      const monthName = this.getMonthName(date);
      const monthNumber = date.getMonth();

      const days: Day[] = [];

      do {
        days.push({
          number: date.getDate(),
          weekDay: date.toLocaleString('default', {
            weekday: 'short',
          }) as WeekDay,
          date: new Date(date),
        });
        date.setDate(date.getDate() + 1);
      } while (monthName === this.getMonthName(date));

      this.months[monthName] = {
        name: monthName,
        number: monthNumber,
        days,
        startUTC: moment.utc(`${this.year}-${(monthNumber + 1).toString().padStart(2, '0')}-01`),
        endUTC: moment.utc(
          `${this.year}-${(monthNumber + 1).toString().padStart(2, '0')}-${days.length}`
        ),
        events: [],
      } as Month;
    }
  }

  async ngOnInit() {
    this.settings = this.settingsService.getSettings();

    Promise.all([this.calendarService.getColors(), this.calendarService.getCalendars()]).then(
      async (values) => {
        this.colors = values[0];
        this.calendars = values[1];

        this.loadEventsIntoCalendars();
      }
    );
  }

  isEventDeclined(event: GoogleCalendarEvent): boolean {
    if (event.attendees == null) return false;

    for (const attendee of event.attendees) {
      if (attendee.self && attendee.responseStatus === 'declined') return true;
    }

    return false;
  }

  addEventsToCalendar(events: GoogleCalendarEvent[], calendar: GoogleCalendar) {
    for (const event of events.filter((event) => !this.isEventDeclined(event))) {
      // Filter out declined events
      const startDate = moment(event.start.date ?? event.start.dateTime);
      let endDate = moment(event.end.date ?? event.end.dateTime);
      // If the time is midnight, set the time to 23:59:59 to avoid the event being considered as the next day
      if (endDate.hour() === 0 && endDate.minute() === 0) endDate = endDate.subtract(1, 'second');

      const startMonth = this.getMonthName(new Date(event.start.date ?? event.start.dateTime));
      const endMonth = this.getMonthName(endDate.toDate());

      if (event.summary.includes('Emporium wedding')) debugger;

      const calendarEvent = {
        id: event.id,
        title: event.summary,
        description: event.description,
        start: startDate.toDate(),
        end: endDate.toDate(),
        colour: calendar.backgroundColor,

        startUTC: moment.utc(event.start.date ?? event.start.dateTime),
        endUTC: moment.utc(event.end.date ?? event.end.dateTime),

        calendarId: calendar.id,
      } as EventExtended;

      // Add only if year matches
      if (calendarEvent.startUTC.year() == this.year)
        this.months[startMonth].events.push(calendarEvent);
      if (startMonth !== endMonth && calendarEvent.endUTC.year() === this.year) {
        this.months[endMonth].events.push(calendarEvent);
      }

      // Force push to trigger change detection
      this.months[startMonth].events = [...this.months[startMonth].events];
      this.months[endMonth].events = [...this.months[endMonth].events];
    }
  }

  async loadEventsIntoCalendars() {
    const yearStart = new Date(`${this.year}-01-01T00:00:00Z`);
    const yearEnd = new Date(`${this.year}-12-31T23:59:59Z`);

    this.calendars
      .filter((calendar) => this.settings.allowedCalendars.includes(calendar.id)) // Only calendars that are enabled
      .forEach((calendar) => this.loadEventsIntoCalendar(calendar, yearStart, yearEnd)); // Load events for each calendar in parallel
  }

  async loadEventsIntoCalendar(calendar: GoogleCalendar, start: Date, end: Date) {
    try {
      let events = await this.calendarService.getEvents(start, end, calendar.id);

      // remove recurring events // TODO: this should be a setting
      events = events.filter((event) => event.recurringEventId == null);

      this.addEventsToCalendar(events, calendar);
    } catch (e) {
      console.log(e);
    }
  }

  async loadColors() {
    this.colors = await this.calendarService.getColors();
  }

  changeYear(newYear: number) {
    this.year = newYear;
    this.events = [];
    this.buildMonths();
    this.loadEventsIntoCalendars();
  }

  selectColor(colorId: string) {
    this.selectedColorId = colorId;
  }

  get canCreateNewEvent() {
    return this.selectedColorId != null;
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
    if (this.selectedColorId == null) this.showEventsList(events, mouseEvent);
    else this.tryCreateEvent(date, mouseEvent);
  }

  tryCreateEvent(date: Date, mouseEvent: MouseEvent) {
    if (this.eventStart == null) {
      this.eventStart = date;
      return;
    }

    if (this.eventEnd == null) this.eventEnd = date;

    this.requestNewEventDetails(mouseEvent);
  }

  // TODO: Move to service
  isEventsListWindowOpen: boolean = false;
  eventsListInfo: Event[] = [];
  showEventsList(events: Event[], mouseEvent: MouseEvent) {
    if (events == null || events.length == 0) return;
    this.eventsListInfo = events;
    this.isEventsListWindowOpen = true;
    this.mousePosition = mouseEvent;
  }

  // TODO: Move to service
  isEditEventWindowOpen: boolean = false;
  newEvent: Event = {} as Event;
  mousePosition: MouseEvent | undefined;
  showEditEvent(event: Event, mouseEvent: MouseEvent) {
    this.newEvent = event;
    this.eventsToAdd.push(event);
    this.isEditEventWindowOpen = true;
    this.mousePosition = mouseEvent;
  }

  requestNewEventDetails(mouseEvent: MouseEvent) {
    const eventStartUTC = moment.utc(this.eventStart);
    const eventEndUTC = moment.utc(this.eventEnd);

    // Invert dates if the start date is after the end date
    if (eventStartUTC.isAfter(eventEndUTC)) {
      const temp = this.eventStart;
      this.eventStart = this.eventEnd;
      this.eventEnd = temp;
    }

    const newEvent = {
      id: uuidv4(),
      title: '',
      description: '',
      start: this.eventStart,
      end: this.eventEnd,
      colour: this.colors[this.selectedColorId!].background,
      colorId: this.selectedColorId,

      startUTC: eventStartUTC,
      endUTC: eventEndUTC,
    } as Event;

    this.showEditEvent(newEvent, mouseEvent);
  }

  onEditEventComplete({ event, cancel }: { event?: Event; cancel?: boolean }) {
    this.eventStart = undefined;
    this.eventEnd = undefined;
    this.eventsToAdd.pop();

    if (cancel || event == null) return;

    event!.description += '\n~🗃️~';
    // replace last event
    this.eventsToAdd.push(event!);
  }

  eventsToDelete: Event[] = [];
  onListEventsComplete({ deletedIds, cancel }: { deletedIds: string[]; cancel?: boolean }) {
    if (cancel || deletedIds.length == 0) return;

    this.eventsToDelete = [
      ...this.eventsToDelete,
      ...this.events.filter((event) => deletedIds.includes(event.id)),
    ];

    this.events = this.events.filter((event) => !deletedIds?.includes(event.id));
    this.eventsToAdd = this.eventsToAdd.filter((event) => !deletedIds?.includes(event.id));

    // this.loadMonthsEvents();
  }

  async pushChanges() {
    const gEvents: GoogleCalendarEvent[] = this.eventsToAdd.map((event) => {
      return {
        summary: event.title,
        description: event.description,
        start: {
          date: moment(event.start).format('YYYY-MM-DD'),
        },
        end: {
          date: moment(event.end).add(1, 'day').format('YYYY-MM-DD'),
        },
        colorId: event.colorId,
      } as GoogleCalendarEvent;
    });
    await this.calendarService.createEvents(gEvents);

    await this.calendarService.deleteEvents(this.eventsToDelete.map((event) => event.id));

    this.eventsToAdd = [];
    this.eventsToDelete = [];

    // await this.loadEvents();
  }

  get todaysPercentage(): number {
    const todayDay = moment.utc().dayOfYear();
    const yearDays = moment.utc().isLeapYear() ? 366 : 365;
    const percentage = (todayDay / yearDays) * 100;
    return percentage;
  }

  // UTIL functions
  getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long' });
  }

  getEventsInBetween(start: Moment, end: Moment, events: Event[]) {
    return events.filter(
      (event) =>
        event.startUTC.isBetween(start, end, undefined, '[]') ||
        event.endUTC.isBetween(start, end, undefined, '[]')
    );
  }

  monthsOrder = (a: KeyValue<string, Month>, b: KeyValue<string, Month>): number => {
    return a.value.number - b.value.number;
  };
}
