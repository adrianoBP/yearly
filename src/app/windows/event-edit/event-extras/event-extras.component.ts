import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare, faCloudSun, faPlane } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';
import { FlightInfo, findFlight } from '../../../features/flight';
import { DailyForecast, describeWeather, weatherWarnings } from '../../../features/weather';
import { FeaturesService } from '../../../services/features.service';
import { FORECAST_DAYS, WeatherService } from '../../../services/weather.service';

const MAX_DAYS_SHOWN = 7;

/** Flight details and weather under an event's fields */
@Component({
  selector: 'app-event-extras',
  imports: [FontAwesomeModule],
  templateUrl: './event-extras.component.html',
  styleUrl: './event-extras.component.css',
})
export class EventExtrasComponent implements OnChanges, OnDestroy {
  @Input() title = '';
  @Input() description?: string;
  @Input() location?: string;
  /** ISO strings, empty while the dates being typed are invalid; end is exclusive */
  @Input() start = '';
  @Input() end = '';

  constructor(
    public features: FeaturesService,
    private weatherService: WeatherService
  ) {}

  flightIcon = faPlane;
  weatherIcon = faCloudSun;
  externalIcon = faArrowUpRightFromSquare;

  flight: FlightInfo | null = null;
  forecast: DailyForecast[] | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  /** Drops answers to requests that a newer change has overtaken */
  private loadId = 0;

  describe = describeWeather;
  warnings = weatherWarnings;

  ngOnChanges(changes: SimpleChanges) {
    this.flight = this.features.isOn('flights')
      ? findFlight(`${this.title ?? ''} ${this.description ?? ''} ${this.location ?? ''}`)
      : null;

    if (changes['location'] || changes['start'] || changes['end']) {
      // Wait for typing to settle before looking the place up
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

  get shownForecast() {
    return this.forecast?.slice(0, MAX_DAYS_SHOWN) ?? [];
  }

  /** Shows weather only when there's a real forecast; anything else (too far ahead, unknown place, offline) shows nothing */
  private async load() {
    const id = ++this.loadId;
    const start = moment(this.start);
    const end = moment(this.end);
    this.forecast = null;
    const lastForecastDay = moment().startOf('day').add(FORECAST_DAYS, 'days');
    if (!this.features.isOn('weather') || !this.location?.trim() || !this.start || !this.end) return;
    if (end.isBefore(moment()) || !start.isBefore(lastForecastDay)) return;

    try {
      const place = await this.weatherService.geocode(this.location);
      if (place == null || id !== this.loadId) return;
      const forecast = await this.weatherService.forecast(place, start, end);
      if (id === this.loadId) this.forecast = forecast;
    } catch {
      // No forecast to show
    }
  }
}
