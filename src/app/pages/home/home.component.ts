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
  faCalendarPlus,
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
import { WindowsService } from '../../windows/windows.service';
import { EventsListParameters } from '../../windows/events-list/events-list.component';
import { EditEventParameters } from '../../windows/event-edit/event-edit.component';
import { UtilService } from '../../services/util.service';

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
  addEventIcon = faCalendarPlus;

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
    public calendarService: CalendarService,
    private settingsService: SettingsService,
    public windowsService: WindowsService,
    private utilService: UtilService
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
        startMoment: moment(`${this.year}-${(monthNumber + 1).toString().padStart(2, '0')}-01`),
        endMoment: moment(
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

      const today = new Date();
      const dayId = 'day-' + today.getDate() + '-' + today.getMonth() + '-' + today.getFullYear();
      document.getElementById(dayId)!.scrollIntoView({ behavior: 'smooth' });
    });

    // const testEvent = {
    //   start: new Date(),
    //   end: new Date(),
    //   title: 'Test event',
    //   description: 'This is a test event',
    //   colour: '#ff0000',
    //   calendarId: 'adriano.boccardo@gmail.com',
    // } as Event;

    // this.windowsService.openWindow('edit-event', {
    //   event: testEvent,
    //   isNewEvent: false,
    // } as EditEventParameters);
  }

  isEventDeclined(event: GoogleCalendarEvent): boolean {
    if (event.attendees == null) return false;

    for (const attendee of event.attendees) {
      if (attendee.self && attendee.responseStatus === 'declined') return true;
    }

    return false;
  }

  addEventsToCalendar(events: Event[], calendarId: string | null = null) {
    for (const event of events) {
      const statMonthNumber = event.startMoment.month();
      let endMonthNumber = event.endMoment.month();

      // event.calendarId = calendarId || event.calendarId;

      // If the end month is in the next year, set it to the last day of the current year
      if (event.endMoment.year() > this.year) endMonthNumber = 11;

      // Loop through the months
      for (let monthNumber = statMonthNumber; monthNumber <= endMonthNumber; monthNumber++) {
        const monthName = this.getMonthName(new Date(`${this.year}-${monthNumber + 1}-01`));
        this.months[monthName].events.push(event);
        this.months[monthName].events = [...this.months[monthName].events];
      }
    }
  }

  removeEventFromCalendar(eventToRemove: Event): void {
    // Remove the event from all the months
    for (
      let monthNumber = eventToRemove.startMoment.month();
      monthNumber <= eventToRemove.endMoment.month();
      monthNumber++
    ) {
      const monthName = this.getMonthName(new Date(`${this.year}-${monthNumber + 1}-01`));
      this.months[monthName].events = this.months[monthName].events.filter(
        (event) => event.id !== eventToRemove.id
      );
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
      let events = (await this.calendarService.getEvents(start, end, calendar.id))
        // remove recurring and declined events  // TODO: this should be a setting
        .filter((event) => event.recurringEventId == null && !this.isEventDeclined(event))
        .map((event) =>
          this.utilService.googleEventToEvent(event, calendar.backgroundColor, calendar.id)
        );

      this.addEventsToCalendar(events, calendar.id);
    } catch (e) {
      console.log(e);
    }
  }

  changeYear(newYear: number) {
    this.year = newYear;
    this.buildMonths();
    this.loadEventsIntoCalendars();
  }

  toggleAddEvent() {
    this.calendarService.isAddingEvent = !this.calendarService.isAddingEvent;
  }

  newEventStart: Date | null = null;
  newEventEnd: Date | null = null;
  onDayClickEvent({
    date,
    events,
    mouseEvent,
  }: {
    date: Date;
    events: Event[];
    mouseEvent: MouseEvent;
  }) {
    const side = mouseEvent.clientX < window.innerWidth / 2 ? 'left' : 'right';

    if (this.calendarService.isAddingEvent) {
      if (this.newEventStart == null) {
        this.newEventStart = date;
        return;
      }

      // TODO: FIX when adding an event across years

      if (this.newEventEnd == null) {
        // Add one day to the end date
        this.newEventEnd = new Date(date);

        // If end is before start, swap them
        if (this.newEventEnd < this.newEventStart) {
          const temp = this.newEventEnd;
          this.newEventEnd = this.newEventStart;
          this.newEventStart = temp;
        }

        // Add an extra day to the end date to make it inclusive (full day events reset at midnight of the next day)
        this.newEventEnd.setDate(this.newEventEnd.getDate() + 1);
      }

      const newEvent = {
        id: 'temp-id',
        start: this.newEventStart,
        end: this.newEventEnd,
        title: '',
        colour: '#ff0000',
        calendarId: this.calendars[0].id,

        startMoment: moment(this.newEventStart),
        endMoment: moment(this.newEventEnd),
      } as Event;

      this.addEventsToCalendar([newEvent], '');

      this.windowsService.openWindow(
        'edit-event',
        {
          event: newEvent,
          isNewEvent: true,
        } as EditEventParameters,
        side,
        (createdEvent: Event) => {
          if (createdEvent) {
            this.addEventsToCalendar([createdEvent], createdEvent.calendarId);
          }

          // Remove the temporary event from the calendar
          this.removeEventFromCalendar(newEvent);

          this.newEventStart = null;
          this.newEventEnd = null;
        }
      );

      return;
    }

    if (events?.length > 0) {
      const parameters = { events, date } as EventsListParameters;
      this.windowsService.openWindow(
        'list-events',
        parameters,
        side,
        async (deletedEvents: Event[]) => {
          if (deletedEvents == null || deletedEvents.length == 0) return;

          // Reflect changes in the calendar
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

  monthsOrder = (a: KeyValue<string, Month>, b: KeyValue<string, Month>): number => {
    return a.value.number - b.value.number;
  };
}
