import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';
import { Event } from '../../interfaces/event.interface';
import { CalendarInfo, YearStats, yearStats } from '../../features/year-review';
import { BarChartComponent } from '../../shared/charts/bar-chart.component';
import { YearHeatmapComponent } from '../../shared/charts/year-heatmap.component';
import { WindowParameters, WindowsService } from '../windows.service';

export interface YearReviewParameters extends WindowParameters {
  /** The user's own events for the year (not holidays or other people's calendars) */
  events: Event[];
  calendars: CalendarInfo[];
  /** Shows that day (YYYY-MM-DD) in the year view */
  onPickDay: (date: string) => void;
}

@Component({
  selector: 'app-year-review',
  imports: [FontAwesomeModule, BarChartComponent, YearHeatmapComponent],
  templateUrl: './year-review.component.html',
  styleUrl: './year-review.component.css',
})
export class YearReviewComponent {
  closeIcon = faXmark;
  year: number;
  stats: YearStats;

  private parameters: YearReviewParameters;

  constructor(public windowsService: WindowsService) {
    const parameters = this.parameters = this.windowsService.getOpenedWindow()?.parameters as YearReviewParameters;
    this.year = parameters.date.getFullYear();
    this.stats = yearStats(parameters.events, this.year, parameters.calendars);
  }

  dayLabel(date: string) {
    return moment(date).format('ddd D MMM');
  }

  pickDay(date: string) {
    this.parameters.onPickDay(date);
  }

  get hasTrips() {
    return this.stats.nightsAway > 0;
  }
}
