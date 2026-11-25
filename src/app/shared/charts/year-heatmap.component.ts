import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import moment from 'moment';
import { DayCount } from '../../features/year-review';

interface Cell extends DayCount {
  level: number;
  tip: string;
  /** Columns appear left to right */
  delay: number;
}

/** Sequential blue ramp (reference palette steps 150, 250, 350, 500); level 0 is the empty surface */
const LEVELS = ['var(--surface-2)', '#b7d3f6', '#86b6ef', '#5598e7', '#256abf'];

/** One square per day, weeks as columns, shaded by how many events the day has */
@Component({
  selector: 'app-year-heatmap',
  templateUrl: './year-heatmap.component.html',
  styleUrl: './year-heatmap.component.css',
})
export class YearHeatmapComponent implements OnChanges {
  @Input({ required: true }) days: DayCount[] = [];
  /** A day was clicked (YYYY-MM-DD) */
  @Output() pick = new EventEmitter<string>();
  @ViewChild('figure', { static: true }) figure!: ElementRef<HTMLElement>;

  hover: { tip: string; left: number; top: number } | null = null;

  levels = LEVELS;
  /** Empty slots before 1 January so it lands on its weekday row (Monday first) */
  offset = 0;
  offsetSlots: number[] = [];
  cells: Cell[] = [];
  months: { label: string; column: number }[] = [];
  weekCount = 53;

  ngOnChanges() {
    if (!this.days.length) return;
    const first = moment(this.days[0].date);
    this.offset = first.isoWeekday() - 1;
    this.offsetSlots = new Array(this.offset).fill(0);
    this.weekCount = Math.ceil((this.offset + this.days.length) / 7);
    this.cells = this.days.map((day, i) => ({
      ...day,
      delay: Math.floor((i + this.offset) / 7) * 12,
      level: Math.min(day.count, LEVELS.length - 1),
      tip: `${moment(day.date).format('ddd D MMM')}: ${day.count === 0 ? 'free' : day.count === 1 ? '1 event' : day.count + ' events'}`,
    }));
    this.months = Array.from({ length: 12 }, (_, m) => {
      const index = moment(first).month(m).date(1).dayOfYear() - 1;
      return { label: moment().month(m).format('MMM'), column: Math.floor((this.offset + index) / 7) + 1 };
    });
  }

  show(cell: Cell, event: MouseEvent) {
    const figure = this.figure.nativeElement.getBoundingClientRect();
    const square = (event.target as HTMLElement).getBoundingClientRect();
    // Keep the tooltip's centre far enough from the edges that it stays inside the figure
    const left = Math.min(Math.max(square.left + square.width / 2 - figure.left, 70), figure.width - 70);
    this.hover = { tip: cell.tip, left, top: square.top - figure.top };
  }

  get summary() {
    const busy = this.days.filter((d) => d.count > 0).length;
    return `Activity by day: ${busy} of ${this.days.length} days have events.`;
  }
}
