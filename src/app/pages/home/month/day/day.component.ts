import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { Day } from '../../../../interfaces/month.interface';
import { Event } from '../../../../interfaces/event.interface';

// Keyword in an event title -> icon. Order is the priority when several events match.
const EVENT_ICONS: [string, string][] = [
  ['flight', '✈️'],
  ['ferry', '🚢'],
  ['train', '🚅'],
  ['bus', '🚌'],
];

// Lines that fit under the day number; events in later lanes show as a "more" dot
const MAX_LANES = 3;

@Component({
  selector: 'app-day',
  templateUrl: './day.component.html',
  styleUrl: './day.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayComponent implements OnChanges {
  @Input({ required: true }) day!: Day;
  @Input() events: Event[] = [];
  @Input() isAddingEvent = false;
  @Output() dayClick = new EventEmitter<{ day: Day; mouseEvent: MouseEvent }>();
  /** The hovered day element, or null when the pointer leaves (days with events only) */
  @Output() hoverChange = new EventEmitter<HTMLElement | null>();

  // Only one icon per day due to space constraints
  icon?: string;
  visibleEvents: Event[] = [];
  hasHiddenEvents = false;

  ngOnChanges(): void {
    this.visibleEvents = this.events.filter((event) => event.lane < MAX_LANES);
    this.hasHiddenEvents = this.visibleEvents.length < this.events.length;

    const matched = new Set<string>();
    for (const event of this.events) {
      const title = event.title?.toLowerCase() ?? '';
      // Per event, the keyword appearing first in the title wins
      let best: string | undefined;
      let bestIndex = Infinity;
      for (const [keyword] of EVENT_ICONS) {
        const index = title.indexOf(keyword);
        if (index > -1 && index < bestIndex) [best, bestIndex] = [keyword, index];
      }
      if (best) matched.add(best);
    }
    this.icon = EVENT_ICONS.find(([keyword]) => matched.has(keyword))?.[1];
  }
}
