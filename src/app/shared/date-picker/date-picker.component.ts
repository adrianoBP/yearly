import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import * as lucide from 'lucide';
import { IconComponent } from '../icon/icon.component';

/** Dates travel as 'YYYY-MM-DD' strings, like <input type="date"> */
export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function fromDateKey(key: string | null | undefined): Date | null {
  const match = key ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
}

interface DayCell {
  key: string;
  day: number;
  label: string;
  outside: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

const fullDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fieldDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short' });

// Arrow keys move by day/week, Page Up/Down by month
const KEY_STEPS: Record<string, [months: number, days: number]> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [0, -7],
  ArrowDown: [0, 7],
  PageUp: [-1, 0],
  PageDown: [1, 0],
};

@Component({
  selector: 'app-date-picker',
  imports: [IconComponent],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  host: { '[class.field]': "variant === 'field'" },
})
export class DatePickerComponent {
  @Input() value: string | null = null;
  @Input() min: string | null = null;
  /** Month to show when there's no value yet (defaults to today) */
  @Input() startAt: string | null = null;
  @Input() disabled = false;
  @Input() label = 'Choose date';
  /** 'field' shows the date like a form field; 'icon' is a calendar icon button */
  @Input() variant: 'field' | 'icon' = 'field';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('trigger', { static: true }) trigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('popover', { static: true }) popover!: ElementRef<HTMLElement>;

  calendarIcon = lucide.CalendarDays;
  chevronDownIcon = lucide.ChevronDown;
  prevIcon = lucide.ChevronLeft;
  nextIcon = lucide.ChevronRight;

  readonly weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly monthNames = Array.from({ length: 12 }, (_, i) => shortMonth.format(new Date(2000, i, 1)));

  isOpen = false;
  mode: 'days' | 'months' = 'days';
  /** Keyboard-focused day; its month is the one shown */
  focusDate = new Date();
  cells: DayCell[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  get displayValue(): string {
    const date = fromDateKey(this.value);
    return date ? fieldDate.format(date) : 'Select date';
  }

  get title(): string {
    return this.mode === 'days' ? monthYear.format(this.focusDate) : String(this.focusDate.getFullYear());
  }

  get focusKey(): string {
    return toDateKey(this.focusDate);
  }

  toggle() {
    if (this.isOpen) this.popover.nativeElement.hidePopover();
    else this.open();
  }

  private open() {
    this.focusDate = fromDateKey(this.value) ?? fromDateKey(this.startAt) ?? new Date();
    this.mode = 'days';
    this.buildCells();
    this.cdr.detectChanges(); // render the month before measuring and focusing
    this.popover.nativeElement.showPopover();
    this.position();
    this.focusActiveDay();
  }

  /** Below the trigger, or above it when there's no room; kept inside the window */
  private position() {
    const anchor = this.trigger.nativeElement.getBoundingClientRect();
    const picker = this.popover.nativeElement;
    const { width, height } = picker.getBoundingClientRect();
    const left = Math.min(Math.max(8, anchor.left), innerWidth - width - 8);
    const below = anchor.bottom + 6;
    const top = below + height > innerHeight - 8 ? Math.max(8, anchor.top - 6 - height) : below;
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  onToggle() {
    this.isOpen = this.popover.nativeElement.matches(':popover-open');
    // Closed by Escape or a click outside: give focus back to the button if it was inside
    if (!this.isOpen && (document.activeElement === document.body || this.popover.nativeElement.contains(document.activeElement)))
      this.trigger.nativeElement.focus({ preventScroll: true });
  }

  pick(key: string) {
    this.popover.nativeElement.hidePopover();
    this.trigger.nativeElement.focus({ preventScroll: true });
    // Emit last so the parent can move focus elsewhere (Go to date focuses the day)
    this.valueChange.emit(key);
  }

  pickToday() {
    this.pick(toDateKey(new Date()));
  }

  /** Moves the shown month/day; keeps the day inside the target month */
  shift(months: number, days = 0, focus = false) {
    const { focusDate: d } = this;
    const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), lastDay) + days);
    this.focusDate = target;
    this.buildCells();
    if (focus) {
      this.cdr.detectChanges();
      this.focusActiveDay();
    }
  }

  onDayKeydown(event: KeyboardEvent) {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    this.shift(step[0], step[1], true);
  }

  showMonths() {
    this.mode = 'months';
  }

  pickMonth(month: number) {
    this.shift(month - this.focusDate.getMonth());
    this.mode = 'days';
    this.cdr.detectChanges();
    this.focusActiveDay();
  }

  private focusActiveDay() {
    this.popover.nativeElement.querySelector<HTMLElement>('.d[tabindex="0"]')?.focus({ preventScroll: true });
  }

  private buildCells() {
    const focus = this.focusDate;
    const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // weeks start on Monday
    const todayKey = toDateKey(new Date());
    const min = fromDateKey(this.min);

    this.cells = Array.from({ length: 42 }, (_, i) => {
      const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + i);
      const key = toDateKey(date);
      return {
        key,
        day: date.getDate(),
        label: fullDate.format(date),
        outside: date.getMonth() !== focus.getMonth(),
        today: key === todayKey,
        selected: key === this.value,
        disabled: !!min && date < min,
      };
    });
  }
}
