import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Bar } from '../../features/year-review';

/**
 * Single-series bar chart in plain HTML/CSS: one hue, thin bars with rounded data ends,
 * a value label on the tallest bar only, and hover tooltips on columns (rows show their values).
 */
@Component({
  selector: 'app-bar-chart',
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.css',
})
export class BarChartComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) data: Bar[] = [];
  /** Columns rise from the bottom; horizontal bars grow from the left with labels beside them */
  @Input() orientation: 'vertical' | 'horizontal' = 'vertical';
  /** One line under the title explaining what is counted */
  @Input() subtitle = '';

  @ViewChild('figure', { static: true }) figure!: ElementRef<HTMLElement>;
  hover: { tip: string; left: number; top: number } | null = null;

  show(bar: Bar, event: MouseEvent) {
    const figure = this.figure.nativeElement.getBoundingClientRect();
    const column = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const stack = (event.currentTarget as HTMLElement).querySelector('.stack')!.getBoundingClientRect();
    // Roughly half the tooltip's width from each edge, so it stays inside the figure
    const half = Math.min(bar.hint.length * 3.4 + 8, figure.width / 2);
    const left = Math.min(Math.max(column.left + column.width / 2 - figure.left, half), figure.width - half);
    this.hover = { tip: bar.hint, left, top: Math.max(stack.top - figure.top, 24) };
  }

  get max() {
    return Math.max(1, ...this.data.map((bar) => bar.value));
  }

  /** The first bar with the highest value gets the only direct label */
  get peakIndex() {
    return this.data.findIndex((bar) => bar.value === this.max);
  }

  size(bar: Bar) {
    return (bar.value / this.max) * 100;
  }

  get summary() {
    const peak = this.data[this.peakIndex];
    return peak ? `${this.title}. Highest: ${peak.hint}.` : this.title;
  }
}
