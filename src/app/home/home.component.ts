import { Component } from '@angular/core';
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
import moment from 'moment';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBan,
  faFloppyDisk,
  faDownload,
} from '@fortawesome/free-solid-svg-icons';
import { EditEventsComponent } from '../edit-event/edit-event.component';
import { ListEventsWindowComponent } from '../list-events-window/list-events-window.component';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';

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

  year: number = new Date().getFullYear();
  // months: Month[] = [];
  months: { [key: string]: Month } = {};

  colors: { [key: string]: GoogleCalendarColor } = {};
  events: Event[] = [];

  eventStart: Date | undefined;
  eventEnd: Date | undefined;
  newEvents: Event[] = [];

  selectedColorId: string | undefined;

  constructor(
    public googleAuthService: GoogleAuthService,
    private googleCalendarService: GoogleCalendarService
  ) {
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
      } as Month;
    }
  }

  ngOnInit(): void {
    this.fetchGoogleDetails();
  }

  async fetchGoogleDetails() {
    await this.loadColors(); // We need to wait for the colors to load before we can load the events
    this.loadEvents();
  }

  getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long' });
  }

  loadMonthsEvents() {
    for (let month in this.months) {
      this.months[month].events = this.events.filter((event) => {
        return (
          moment(`${this.year}-${this.months[month].number + 1}-01`).isBetween(
            event.start,
            event.end
          ) ||
          (this.months[month].number >= event.start.getMonth() &&
            this.months[month].number <= event.end.getMonth())
        );
      });
    }
  }

  async loadEvents() {
    this.newEvents = [];
    this.eventsToDelete = [];

    const start = new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`);
    const end = new Date(`${new Date().getFullYear()}-12-31T23:59:59Z`);

    const result = await this.googleCalendarService.getEvents(start, end);
    this.events = [];
    this.events = result.map((event) => {
      return {
        id: event.id,
        title: event.summary,
        description: event.description,
        start: new Date(event.start.date),
        end: moment(event.end.date).add(-1, 'day').toDate(), // Remove 1 day as Google Calendar API returns the next day at midnight
        colour: this.colors[event.colorId ?? '1'].background,
      } as Event;
    });
    this.events = [...this.events];
    this.loadMonthsEvents();
  }

  async loadColors() {
    this.colors = await this.googleCalendarService.getColors();
  }

  getMonthEvents({ events, number }: Month) {
    return [
      ...(events ?? []),
      ...this.newEvents.filter(
        (event) =>
          number >= event.start.getMonth() && number <= event.end.getMonth()
      ),
    ];
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
    this.newEvents.push(event);
    this.isEditEventWindowOpen = true;
    this.mousePosition = mouseEvent;
  }

  requestNewEventDetails(mouseEvent: MouseEvent) {
    // Invert dates if the start date is after the end date
    if (moment(this.eventStart).isAfter(moment(this.eventEnd))) {
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
    } as Event;

    this.showEditEvent(newEvent, mouseEvent);
  }

  onEditEventComplete({ event, cancel }: { event?: Event; cancel?: boolean }) {
    this.eventStart = undefined;
    this.eventEnd = undefined;
    this.newEvents.pop();

    if (cancel || event == null) return;

    event!.description += '\n~🗃️~';
    // replace last event
    this.newEvents.push(event!);
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
    this.newEvents = this.newEvents.filter(
      (event) => !deletedIds?.includes(event.id)
    );

    this.loadMonthsEvents();
  }

  monthsOrder = (
    a: KeyValue<string, Month>,
    b: KeyValue<string, Month>
  ): number => {
    return a.value.number - b.value.number;
  };

  async pushChanges() {
    const gEvents: GoogleCalendarEvent[] = this.newEvents.map((event) => {
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
    await this.googleCalendarService.createEvents(gEvents);

    await this.googleCalendarService.deleteEvents(
      this.eventsToDelete.map((event) => event.id)
    );

    await this.loadEvents();
  }

  get todaysPercentage(): number {
    const todayDay = moment().dayOfYear();
    const yearDays = moment().isLeapYear() ? 366 : 365;
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
}
