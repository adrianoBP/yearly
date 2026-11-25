import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowUpRightFromSquare,
  faCar,
  faCloudSun,
  faPeopleGroup,
  faPlane,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';
import { NearbyEvent, leaveBy } from '../../../features/crowd';
import { FlightInfo, findFlight } from '../../../features/flight';
import { FlightStatus } from '../../../features/flight-status';
import { Verdict, bufferVerdict, neighbours } from '../../../features/travel';
import { DailyForecast, describeWeather, weatherWarnings } from '../../../features/weather';
import { Event } from '../../../interfaces/event.interface';
import { FeaturesService } from '../../../services/features.service';
import { LiveService } from '../../../services/live.service';
import { SettingsService } from '../../../services/settings.service';
import { FORECAST_DAYS, WeatherService } from '../../../services/weather.service';

const MAX_DAYS_SHOWN = 7;
/** Crowds are looked up for events up to this far ahead */
const CROWD_DAYS_AHEAD = 30;

interface Leg {
  event: Event;
  minutes: number;
  gap: number;
  verdict: Verdict;
}

/** Flight details, weather, travel time between events and crowds near the venue, under an event's fields */
@Component({
  selector: 'app-event-extras',
  imports: [FontAwesomeModule],
  templateUrl: './event-extras.component.html',
  styleUrl: './event-extras.component.css',
})
export class EventExtrasComponent implements OnChanges, OnDestroy {
  @Input() eventId = '';
  @Input() title = '';
  @Input() description?: string;
  @Input() location?: string;
  /** ISO strings, empty while the dates being typed are invalid; end is exclusive */
  @Input() start = '';
  @Input() end = '';
  /** The other events of the day, for travel times between them */
  @Input() neighbours: Event[] = [];

  constructor(
    public features: FeaturesService,
    private weatherService: WeatherService,
    private live: LiveService,
    private settingsService: SettingsService
  ) {}

  flightIcon = faPlane;
  weatherIcon = faCloudSun;
  externalIcon = faArrowUpRightFromSquare;
  travelIcon = faCar;
  crowdIcon = faPeopleGroup;
  refreshIcon = faRotateRight;

  flight: FlightInfo | null = null;
  flightStatus: { status: FlightStatus; at: number } | null = null;
  flightError = '';
  isRefreshing = false;
  forecast: DailyForecast[] | null = null;
  travel: { before?: Leg; after?: Leg } = {};
  crowds: NearbyEvent[] = [];
  home: { minutes: number; leaveBy: Date } | null = null;

  private timer?: ReturnType<typeof setTimeout>;
  /** Drops answers to requests that a newer change has overtaken */
  private loadId = 0;

  describe = describeWeather;
  warnings = weatherWarnings;

  ngOnChanges(changes: SimpleChanges) {
    const previousFlight = this.flight?.flight;
    this.flight = this.features.isOn('flights')
      ? findFlight(`${this.title ?? ''} ${this.description ?? ''} ${this.location ?? ''}`)
      : null;

    if (changes['location'] || changes['start'] || changes['end'] || this.flight?.flight !== previousFlight) {
      // Wait for typing to settle before looking anything up
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.load(), changes['location']?.firstChange ? 0 : 800);
    }
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  dayLabel(date: string) {
    return moment(date).format('ddd D');
  }

  time(date: Date) {
    return moment(date).format('HH:mm');
  }

  get shownForecast() {
    return this.forecast?.slice(0, MAX_DAYS_SHOWN) ?? [];
  }

  get updatedAgo() {
    return this.flightStatus ? moment(this.flightStatus.at).fromNow() : '';
  }

  async refreshFlight() {
    this.isRefreshing = true;
    await this.loadFlight(this.loadId, true);
    this.isRefreshing = false;
  }

  /** Anything that can't be known (too far ahead, unknown place, no key, offline) simply isn't shown */
  private async load() {
    const id = ++this.loadId;
    this.forecast = null;
    this.flightStatus = null;
    this.flightError = '';
    this.travel = {};
    this.crowds = [];
    this.home = null;
    if (!this.start || !this.end) return;
    await Promise.all([this.loadWeather(id), this.loadFlight(id), this.loadTravel(id), this.loadCrowds(id)]);
  }

  private get timed() {
    return !(moment(this.start).format('HH:mm') === '00:00' && moment(this.end).format('HH:mm') === '00:00');
  }

  private async loadWeather(id: number) {
    const [start, end] = [moment(this.start), moment(this.end)];
    if (!this.features.isOn('weather') || !this.location?.trim()) return;
    if (end.isBefore(moment()) || !start.isBefore(moment().startOf('day').add(FORECAST_DAYS, 'days'))) return;
    try {
      const place = await this.weatherService.geocode(this.location);
      if (place == null || id !== this.loadId) return;
      const forecast = await this.weatherService.forecast(place, start, end);
      if (id === this.loadId) this.forecast = forecast;
    } catch {
      // No forecast to show
    }
  }

  /** Live status only around departure: from a day before until half a day after */
  private async loadFlight(id: number, refresh = false) {
    const start = moment(this.start);
    if (!this.flight || this.features.status('flights') !== 'ready') return;
    if (start.isAfter(moment().add(24, 'hours')) || start.isBefore(moment().subtract(12, 'hours'))) return;
    try {
      const result = await this.live.flightStatus(this.flight.flight, start.format('YYYY-MM-DD'), refresh);
      if (id !== this.loadId) return;
      this.flightStatus = result.status ? { status: result.status, at: result.at } : null;
      this.flightError = '';
    } catch (message) {
      if (id === this.loadId) this.flightError = String(message);
    }
  }

  private async loadTravel(id: number) {
    if (!this.features.isOn('travel-buffers') || !this.location?.trim() || !this.timed) return;
    const [start, end] = [moment(this.start), moment(this.end)];
    if (end.isBefore(moment())) return;
    const { before, after } = neighbours({ id: this.eventId, startMoment: start, endMoment: end }, this.neighbours);
    try {
      if (before) {
        const route = await this.live.route(before.location!, this.location, before.endMoment.toDate());
        const gap = start.diff(before.endMoment, 'minutes');
        if (route && id === this.loadId) this.travel.before = { event: before, minutes: route.minutes, gap, verdict: bufferVerdict(gap, route.minutes) };
      }
      if (after) {
        const route = await this.live.route(this.location, after.location!, end.toDate());
        const gap = after.startMoment.diff(end, 'minutes');
        if (route && id === this.loadId) this.travel.after = { event: after, minutes: route.minutes, gap, verdict: bufferVerdict(gap, route.minutes) };
      }
    } catch {
      // No travel times to show
    }
  }

  private async loadCrowds(id: number) {
    if (!this.features.isOn('crowd-alerts') || !this.location?.trim() || !this.timed) return;
    const start = moment(this.start);
    if (start.isBefore(moment()) || start.isAfter(moment().add(CROWD_DAYS_AHEAD, 'days'))) return;
    try {
      const crowds = await this.live.nearby(this.location, this.title ?? '', start.toDate());
      if (id !== this.loadId) return;
      this.crowds = crowds;

      const homeAddress = this.settingsService.getSettings().homeAddress;
      if (homeAddress && this.features.status('crowd-alerts') === 'ready') {
        // Ask for the traffic around when they'd set off, roughly an hour before
        const route = await this.live.route(homeAddress, this.location, start.clone().subtract(1, 'hour').toDate());
        if (route && route.minutes > 0 && id === this.loadId)
          this.home = { minutes: route.minutes, leaveBy: leaveBy(start.toDate(), route.minutes, crowds.length > 0) };
      }
    } catch {
      // No crowd information to show
    }
  }
}
