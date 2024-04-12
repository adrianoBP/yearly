import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Event } from '../interfaces/event.interface';
import moment from 'moment';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-list-events-window',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './list-events-window.component.html',
  styleUrl: './list-events-window.component.css',
})
export class ListEventsWindowComponent {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() events!: Event[];
  @Input() x: number | undefined;
  @Input() y: number | undefined;

  timesIcon = faTimes;

  @Output() onClose = new EventEmitter<{
    deletedIds: string[];
    cancel?: boolean;
  }>();

  @ViewChild('containerRef') containerRef!: ElementRef;

  locationX = 0;
  locationY = 0;
  ngOnChanges(): void {
    this.calculateWindowPosition(window.innerWidth < 768);
  }

  positionPadding = 20;
  calculateWindowPosition(isMobile: boolean): void {
    if (this.x == null || this.y == null) return;

    this.deletedIds = [];

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const containerWidth = this.containerRef.nativeElement.offsetWidth;
    const containerHeight = this.containerRef.nativeElement.offsetHeight;

    if (this.x! + containerWidth + this.positionPadding > windowWidth) {
      this.locationX = this.x - containerWidth - this.positionPadding;
    } else {
      this.locationX = this.x! + this.positionPadding;
    }

    if (this.y! + this.positionPadding + containerHeight > windowHeight) {
      this.locationY = this.y - containerHeight - this.positionPadding;
    } else {
      this.locationY = this.y! + this.positionPadding;
    }

    if (isMobile) this.locationX = 0;
  }

  deletedIds: string[] = [];
  deleteEvent(event: Event): void {
    this.deletedIds.push(event.id);
  }

  cancel(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.onClose.emit({ deletedIds: [], cancel: true });
  }

  ok(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.onClose.emit({ deletedIds: this.deletedIds });
  }

  formatDate(date: Date): string {
    return moment(date).format('DD/MM/YYYY');
  }

  get availableEvents(): Event[] {
    return this.events.filter((e) => !this.deletedIds.includes(e.id));
  }

  isOneDayEvent(event: Event): boolean {
    return (
      moment(event.start).format('DD/MM/YYYY') ===
      moment(event.end).format('DD/MM/YYYY')
    );
  }
}
