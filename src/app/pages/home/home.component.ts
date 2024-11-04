import { Component, Injector } from '@angular/core';
import { Day, Month, WeekDay } from '../../interfaces/month.interface';
import { CommonModule, KeyValue } from '@angular/common';
import { MonthComponent } from './month/month.component';
import { GoogleAuthService } from '../../services/google/auth.service';
import { GoogleCalendarEvent, GoogleCalendar } from '../../services/google/calendar.service';
import { Event } from '../../interfaces/event.interface';
import moment, { Moment } from 'moment';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBan,
  faChevronLeft,
  faChevronRight,
  faCog,
  faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';
import { MockAuthService } from '../../services/mock/auth.service';
import { mockData } from '../../app.config';
import { Router } from '@angular/router';
import { CalendarService } from '../../services/calendar.service';
import { Settings, SettingsService } from '../../services/settings.service';
import { WindowContainerComponent } from '../../windows/window-container/window-container.component';
import { WindowParameters, WindowsService } from '../../windows/windows.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, MonthComponent, WindowContainerComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  // FontAwesome icons
  banIcon = faBan;
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

  calendars: GoogleCalendar[] = [];

  authService: GoogleAuthService | MockAuthService;

  constructor(
    private injector: Injector,
    public router: Router,
    private calendarService: CalendarService,
    private settingsService: SettingsService,
    public windowsService: WindowsService
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

    Promise.all([this.calendarService.getCalendars()]).then(async (values) => {
      this.calendars = values[0];

      this.loadEventsIntoCalendars();
    });
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

        allDay: !event.start.dateTime,
      } as Event;

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

  changeYear(newYear: number) {
    this.year = newYear;
    this.buildMonths();
    this.loadEventsIntoCalendars();
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
    if (events?.length > 0) {
      const side = mouseEvent.clientX < window.innerWidth / 2 ? 'left' : 'right';
      const parameters = { eventsList: events, date } as WindowParameters;
      this.windowsService.openWindow(
        'list-events',
        parameters,
        side,
        async (deletedEvents: Event[]) => {
          if (deletedEvents == null || deletedEvents.length == 0) return;

          await this.calendarService.deleteEvents(deletedEvents);

          const deletedEventsIds = deletedEvents.map((event) => event.id);
          const monthName = this.getMonthName(date);

          this.months[monthName].events = this.months[monthName].events.filter(
            (event) => !deletedEventsIds.includes(event.id)
          );
        }
      );
    }
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
