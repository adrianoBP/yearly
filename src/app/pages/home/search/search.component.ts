import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import moment from 'moment';
import * as lucide from 'lucide';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Event } from '../../../interfaces/event.interface';
import { dateQuery, searchEvents } from '../../../features/search';
import { when } from '../../../features/ask';

export interface SearchCommand {
  label: string;
  icon: lucide.IconNode;
  run: () => void;
}

interface Result {
  label: string;
  sub?: string;
  colour?: string;
  icon?: lucide.IconNode;
  run: () => void;
}

/** Ctrl+K panel: finds loaded events, jumps to a typed date, opens tools. Everything runs on the device. */
@Component({
  selector: 'app-search',
  imports: [IconComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchComponent {
  /** A picked event or date, as YYYY-MM-DD */
  @Output() pickDate = new EventEmitter<string>();
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;

  searchIcon = lucide.Search;

  query = '';
  results: Result[] = [];
  active = 0;
  years = '';
  private events: Event[] = [];
  private commands: SearchCommand[] = [];

  open(events: Event[], commands: SearchCommand[], years: string) {
    this.events = events;
    this.commands = commands;
    this.years = years;
    this.query = '';
    this.update();
    this.dialog.nativeElement.showModal();
  }

  update() {
    const query = this.query.trim();
    const lower = query.toLowerCase();
    const date = query ? dateQuery(query) : null;
    const go = (day: moment.MomentInput) => () => this.pickDate.emit(moment(day).format('YYYY-MM-DD'));
    this.results = [
      ...(date ? [{ label: `Go to ${moment(date).format('dddd D MMMM YYYY')}`, icon: lucide.CalendarDays, run: go(date) }] : []),
      ...searchEvents(query, this.events).map((event) => ({
        label: event.title || '(No title)',
        sub: when(event, true),
        colour: event.colour,
        run: go(event.startMoment),
      })),
      ...this.commands.filter((command) => command.label.toLowerCase().includes(lower)),
    ];
    this.active = 0;
  }

  onKeydown(event: KeyboardEvent) {
    const count = this.results.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!count) return;
      this.active = (this.active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
      document.getElementById(`search-${this.active}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && count) {
      event.preventDefault();
      this.pick(this.results[this.active]);
    }
  }

  pick(result: Result) {
    this.dialog.nativeElement.close();
    result.run();
  }
}
