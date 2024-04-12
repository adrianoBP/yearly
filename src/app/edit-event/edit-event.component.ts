import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Event } from '../interfaces/event.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-event',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-event.component.html',
  styleUrl: './edit-event.component.css',
})
export class EditEventsComponent {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() event!: Event;
  @Input() x: number | undefined;
  @Input() y: number | undefined;

  @Output() onClose = new EventEmitter<{ event?: Event; cancel?: boolean }>();

  @ViewChild('containerRef') containerRef!: ElementRef;

  locationX = 0;
  locationY = 0;
  ngOnChanges(): void {
    this.calculateWindowPosition(window.innerWidth < 768);
  }

  positionPadding = 20;
  calculateWindowPosition(isMobile: boolean): void {
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

    if (isMobile) this.locationX = 0;
  }

  cancel(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.onClose.emit({ cancel: true });
  }

  ok(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.onClose.emit({ event: this.event });
  }
}
