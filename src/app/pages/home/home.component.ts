import { Component, Inject } from '@angular/core';
import { Day, Month, WeekDay } from '../../interfaces/month.interface';
import { CommonModule, KeyValue } from '@angular/common';
import { MonthComponent } from './month/month.component';
import { GoogleCalendarEvent, GoogleCalendar } from '../../services/google/calendar.service';
import { Event, EventDisplayDetails } from '../../interfaces/event.interface';
import moment from 'moment';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBan,
  faCalendarPlus,
  faChevronLeft,
  faChevronRight,
  faCog,
  faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';
import { Router } from '@angular/router';
import { CalendarService } from '../../services/api/calendar.service';
import { Settings, SettingsService } from '../../services/settings.service';
import { WindowContainerComponent } from '../../windows/window-container/window-container.component';
import { WindowsService } from '../../windows/windows.service';
import { EventsListParameters } from '../../windows/events-list/events-list.component';
import { EditEventParameters } from '../../windows/event-edit/event-edit.component';
import { UtilService } from '../../services/util.service';
import {
  trigger,
  state,
  style,
  transition,
  animate,
  query,
  animateChild,
} from '@angular/animations';
import { MobileUtilService } from '../../services/mobile.util.service';
import { AuthService } from '../../services/api/auth.service';
import { UserService } from '../../services/api/user.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, FontAwesomeModule, MonthComponent, WindowContainerComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  animations: [
    trigger('inOutPaneAnimation', [
      state('open', style({ 'background-color': 'rgba(0, 0, 0, 0.5)' })),
      transition(':enter', [animate('0.2s ease-in-out'), query('@swipe', animateChild())]),
      transition(':leave', [
        query('@swipe', animateChild()),
        animate('0.2s ease-in-out', style({ 'background-color': 'rgba(0, 0, 0, 0)' })),
      ]),
    ]),
  ],
})
export class HomeComponent {
  // FontAwesome icons
  banIcon = faBan;
  chevronLeftIcon = faChevronLeft;
  chevronRightIcon = faChevronRight;
  cogIcon = faCog;
  exitIcon = faSignOutAlt;
  addEventIcon = faCalendarPlus;

  isLoading = true;

  settings: Settings = {
    calendars: [],
  };

  currentYear = new Date().getFullYear();

  year: number = new Date().getFullYear();
  months: { [key: string]: Month } = {};

  calendars: GoogleCalendar[] = [];

  constructor(
    @Inject(Router) public router: Router,
    public authService: AuthService,
    public calendarService: CalendarService,
    private settingsService: SettingsService,
    public windowsService: WindowsService,
    private utilService: UtilService,
    private mobileUtilService: MobileUtilService,
    private userService: UserService
  ) {
    this.buildMonths();
  }

  async ngOnInit() {
    this.settingsService.setStyle();

    this.addPageEventListeners();

    this.settings = this.settingsService.getSettings();

    this.calendars = await this.calendarService.getCalendars();
    this.loadEventsIntoCalendars();
    this.mobileUtilService.scrollTodayIntoView();
  }

  buildMonths() {
    this.months = {};

    const date = moment().set('year', this.year).set('month', 0).set('date', 1).toDate();

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

  addPageEventListeners(): void {
    // Read for Escape button to close windows
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        // TODO: settings #6
        this.windowsService.backAllWindows();
      }
    });
  }

  isEventDeclined(event: GoogleCalendarEvent): boolean {
    if (event.attendees == null) return false;

    for (const attendee of event.attendees) {
      if (attendee.self && attendee.responseStatus === 'declined') return true;
    }

    return false;
  }

  addEventsToCalendar(events: Event[]) {
    for (const event of events) {
      // If the start of the event is in the previous year, we want the beginning of the year
      const statMonthNumber = event.startMoment.year() < this.year ? 0 : event.startMoment.month();
      // If the end of the event is in the next year, we want the end of the year
      let endMonthNumber = event.endMoment.year() > this.year ? 11 : event.endMoment.month();

      // If the end month is in the next year, set it to the last day of the current year
      if (event.endMoment.year() > this.year) endMonthNumber = 11;

      // Loop through the months
      for (let monthNumber = statMonthNumber; monthNumber <= endMonthNumber; monthNumber++) {
        const date = moment()
          .set('year', this.year)
          .set('month', monthNumber)
          .set('date', 1)
          .toDate();
        const monthName = this.getMonthName(date);
        this.months[monthName].events.push(event);
        this.months[monthName].events = [...this.months[monthName].events];
      }
    }
  }

  removeEventsFromCalendar(eventsId: string[]): void {
    // Remove the event from all the months
    for (let monthNumber = 0; monthNumber <= 11; monthNumber++) {
      const date = moment()
        .set('year', this.year)
        .set('month', monthNumber)
        .set('date', 1)
        .toDate();
      const monthName = this.getMonthName(date);
      this.months[monthName].events = this.months[monthName].events.filter(
        (event) => !eventsId.includes(event.id)
      );
    }
  }

  async loadEventsIntoCalendars() {
    const yearStart = moment()
      .set('year', this.year)
      .set('month', 0)
      .set('date', 1)
      .set('hour', 0)
      .set('minute', 0)
      .set('second', 0)
      .toDate();
    const yearEnd = moment()
      .set('year', this.year)
      .set('month', 11)
      .set('date', 31)
      .set('hour', 23)
      .set('minute', 59)
      .set('second', 59)
      .toDate();

    // for now used only to ensure that the user is logged in
    await this.calendarService.getSettings();

    try {
      this.isLoading = true;
      const promises = this.calendars
        .filter(
          (calendar) =>
            this.settings.calendars.find((cal) => cal.id === calendar.id)?.allowed ?? false
        ) // Only calendars that are enabled
        .map((calendar) => this.loadEventsIntoCalendar(calendar, yearStart, yearEnd)); // Load events for each calendar in parallel

      await Promise.all(promises);
    } finally {
      this.isLoading = false;
    }
  }

  async loadEventsIntoCalendar(calendar: GoogleCalendar, start: Date, end: Date): Promise<void> {
    try {
      const calendarSettings = this.settings.calendars.find((cal) => cal.id === calendar.id);

      let events = (await this.calendarService.getEvents(start, end, calendar.id))
        // remove recurring and declined events
        .filter(
          (event) =>
            (event.recurringEventId == null ||
              (calendarSettings?.allowRecurring && // Show recurring if enabled
                (event.eventType != 'birthday' || calendarSettings?.allowBirthdays))) && // Show birthdays if enabled (birthdays are recurring)
            (calendarSettings?.showDeclinedEvents || !this.isEventDeclined(event))
        )
        .map((event) =>
          this.utilService.googleEventToEvent(event, calendar.backgroundColor, calendar.id)
        );

      this.addEventsToCalendar(events);
    } catch (e) {
      console.log(e);
    }
  }

  async changeYear(newYear: number) {
    if (this.isLoading) return;

    this.year = newYear;
    this.buildMonths();
    this.calendars = await this.calendarService.getCalendars();
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
    // If user clicks on the left side of the screen, open the window on the right side and vice versa
    const side = mouseEvent.clientX < window.innerWidth / 2 ? 'right' : 'left';

    if (this.calendarService.isAddingEvent) {
      // TODO: Add to separate functions
      if (this.newEventStart == null) {
        this.newEventStart = date;
        return;
      }

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
        if (this.newEventStart.getDate() != this.newEventEnd.getDate()) {
          this.newEventStart.setHours(0, 0, 0, 0);
          this.newEventEnd.setHours(0, 0, 0, 0);
          this.newEventEnd.setDate(this.newEventEnd.getDate() + 1);
        } else {
          // Add one hour to the end time for practicality
          this.newEventEnd.setHours(this.newEventEnd.getHours() + 1);
        }
      }

      const newEvent = {
        id: 'temp-id',
        title: '',
        colour: '#ff0000',
        eventType: 'default',
        creator: {
          email: this.userService.emailAddress,
        },
        calendarId: this.calendars[0].id,

        startMoment: moment(this.newEventStart),
        endMoment: moment(this.newEventEnd),
        canEdit: true,
      } as EventDisplayDetails;

      this.addEventsToCalendar([newEvent]);

      this.windowsService.openWindow(
        'edit-event',
        {
          event: newEvent,
          isNewEvent: true,
        } as EditEventParameters,
        side,
        (createdEvent: Event) => {
          if (createdEvent) {
            this.addEventsToCalendar([createdEvent]);
          }
          // Remove the temporary event from the calendar
          this.removeEventsFromCalendar([newEvent.id]);
          this.newEventStart = null;
          this.newEventEnd = null;
        },
        () => {
          // Remove the temporary event from the calendar
          this.removeEventsFromCalendar([newEvent.id]);
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

          if (deletedEvents.length > 0) {
            const deletedEventsIds = deletedEvents.map((event) => event.id);
            this.removeEventsFromCalendar(deletedEventsIds);
          }

          if (updatedEvents.length > 0) {
            this.removeEventsFromCalendar(updatedEvents.map((event) => event.id));
            this.addEventsToCalendar(updatedEvents);
          }
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
