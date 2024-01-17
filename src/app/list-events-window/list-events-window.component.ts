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

@Component({
  selector: 'app-list-events-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-events-window.component.html',
  styleUrl: './list-events-window.component.css',
})
export class ListEventsWindowComponent {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() events!: Event[];
  @Input() x: number | undefined;
  @Input() y: number | undefined;

  @Output() onClose = new EventEmitter<{
    deletedEvents: Event[];
    cancel?: boolean;
  }>();

  @ViewChild('containerRef') containerRef!: ElementRef;

  locationX = 0;
  locationY = 0;
  ngOnChanges(): void {
    this.calculateWindowPosition();
  }

  positionPadding = 20;
  calculateWindowPosition(): void {
    if (this.x == null || this.y == null) return;

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
  }

  cancel(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    // this.onClose.emit({ cancel: true });
  }

  ok(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    // this.onClose.emit({ events: this.events });
  }

  formatDate(date: Date): string {
    return moment(date).format('DD/MM/YYYY');
  }
}
