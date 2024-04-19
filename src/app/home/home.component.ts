import { Component, Injector } from '@angular/core';
import { Day, Month, WeekDay } from '../interfaces/month.interface';
import { CommonModule, KeyValue } from '@angular/common';
import { MonthComponent } from './month/month.component';
import { GoogleAuthService } from '../services/google/auth.service';
import {
  GoogleCalendarColor,
  GoogleCalendarService,
  GoogleCalendarEvent,
} from '../services/google/calendar.service';
import { Event } from '../interfaces/event.interface';
import moment, { Moment } from 'moment';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBan,
  faFloppyDisk,
  faDownload,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { EditEventsComponent } from '../edit-event/edit-event.component';
import { ListEventsWindowComponent } from '../list-events-window/list-events-window.component';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import { MockCalendarService } from '../services/mock/calendar.service';
import { MockAuthService } from '../services/mock/auth.service';
import { mockData } from '../app.config';
import { BehaviorSubject } from 'rxjs';

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

  currentYear = new Date().getFullYear();

  year: number = new Date().getFullYear();
  months: { [key: string]: Month } = {};

  colors: { [key: string]: GoogleCalendarColor } = {};
  events: Event[] = [];

  eventStart: Date | undefined;
  eventEnd: Date | undefined;
  eventsToAdd: Event[] = [];

  selectedColorId: string | undefined;

  authService: GoogleAuthService | MockAuthService;
  calendarService: GoogleCalendarService | MockCalendarService;

  constructor(private injector: Injector) {
    this.authService = mockData
      ? this.injector.get(MockAuthService)
      : this.injector.get(GoogleAuthService);
    this.calendarService = mockData
      ? this.injector.get(MockCalendarService)
      : this.injector.get(GoogleCalendarService);

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
        startUTC: moment.utc(
          `${this.year}-${(monthNumber + 1).toString().padStart(2, '0')}-01`
        ),
        endUTC: moment.utc(
          `${this.year}-${(monthNumber + 1).toString().padStart(2, '0')}-${
            days.length
          }`
        ),
      } as Month;
    }
  }

  async ngOnInit() {
    await this.loadColors(); // We need to wait for the colors to load before we can load the events
    this.loadEvents();
  }

  loadMonthsEvents() {
    for (let month in this.months) {
      const monthStart = this.months[month].startUTC;
      const monthEnd = this.months[month].endUTC;
      this.months[month].events = this.getEventsInBetween(
        monthStart,
        monthEnd,
        this.events
      );
    }
  }

  async loadEvents() {
    const yearStart = new Date(`${this.year}-01-01T00:00:00Z`);
    const yearEnd = new Date(`${this.year}-12-31T23:59:59Z`);

    const result = await this.calendarService.getEvents(yearStart, yearEnd);
    this.events = [];
    this.events = result.map((event) => {
      return {
        id: event.id,
        title: event.summary,
        description: event.description,
        start: moment(event.start.date).toDate(),
        end: moment(event.end.date).add(-1, 'day').toDate(), // Remove 1 day as Google Calendar API returns the next day at midnight
        colour: this.colors[event.colorId ?? '1'].background,

        startUTC: moment.utc(event.start.date),
        endUTC: moment.utc(event.end.date),
      } as Event;
    });
    this.events = [...this.events];
    this.loadMonthsEvents();
  }

  async loadColors() {
    this.colors = await this.calendarService.getColors();
  }

  getMonthEvents({ events, startUTC: monthStart, endUTC: monthEnd }: Month) {
    return [
      ...(events ?? []),
      ...this.getEventsInBetween(monthStart, monthEnd, this.eventsToAdd),
    ].filter(
      (event) => this.eventsToDelete.findIndex((e) => e.id === event.id) === -1
    );
  }

  changeYear(newYear: number) {
    this.year = newYear;
    this.events = [];
    this.buildMonths();
    this.loadEvents();
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
  onListEventsComplete({
    deletedIds,
    cancel,
  }: {
    deletedIds: string[];
    cancel?: boolean;
  }) {
    if (cancel || deletedIds.length == 0) return;

    this.eventsToDelete = [
      ...this.eventsToDelete,
      ...this.events.filter((event) => deletedIds.includes(event.id)),
    ];

    this.events = this.events.filter(
      (event) => !deletedIds?.includes(event.id)
    );
    this.eventsToAdd = this.eventsToAdd.filter(
      (event) => !deletedIds?.includes(event.id)
    );

    this.loadMonthsEvents();
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

    await this.calendarService.deleteEvents(
      this.eventsToDelete.map((event) => event.id)
    );

    this.eventsToAdd = [];
    this.eventsToDelete = [];

    await this.loadEvents();
  }

  get todaysPercentage(): number {
    const todayDay = moment.utc().dayOfYear();
    const yearDays = moment.utc().isLeapYear() ? 366 : 365;
    const percentage = (todayDay / yearDays) * 100;
    return percentage;
  }

  share() {
    html2canvas(document.querySelector('#calendar')!).then(function (canvas) {
      // download
      const img = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'calendar.png';
      link.href = img;
      link.click();
      link.remove();
    });
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

  monthsOrder = (
    a: KeyValue<string, Month>,
    b: KeyValue<string, Month>
  ): number => {
    return a.value.number - b.value.number;
  };
}
