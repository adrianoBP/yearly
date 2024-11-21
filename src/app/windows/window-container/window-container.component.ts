import { Component } from '@angular/core';
import { EventsListComponent } from '../events-list/events-list.component';
import { WindowsService } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { style, animate, transition, trigger } from '@angular/animations';
import { EventEditComponent } from '../event-edit/event-edit.component';
import { MobileUtilService } from '../../services/mobile.util.service';

@Component({
  selector: 'app-window-container',
  imports: [CommonModule, FormsModule, EventsListComponent, EventEditComponent],
  templateUrl: './window-container.component.html',
  styleUrl: './window-container.component.css',
  animations: [
    trigger('swipe', [
      transition(':enter', [
        style({ transform: 'translate{{axis}}({{startPercentage}}%)' }),
        animate('100ms', style({ transform: 'translate{{axis}}(0)' })),
      ]),
      transition(':leave', [
        animate('100ms', style({ transform: 'translate{{axis}}({{startPercentage}}%)' })),
      ]),
    ]),
  ],
})
export class WindowContainerComponent {
  openingSide: string | null;

  constructor(public windowsService: WindowsService, private mobileUtilService: MobileUtilService) {
    this.openingSide = this.mobileUtilService.isMobile()
      ? null
      : this.windowsService.getOpenedWindow()!.side;
  }

  getParameters() {
    return {
      axis: this.mobileUtilService.isMobile() ? 'Y' : 'X',
      startPercentage:
        this.mobileUtilService.isMobile() || this.windowsService.getOpenedWindow()?.side === 'right'
          ? 120
          : -120,
    };
  }
}
