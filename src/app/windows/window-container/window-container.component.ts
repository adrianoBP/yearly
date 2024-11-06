import { Component } from '@angular/core';
import { EventsListComponent, EventsListParameters } from '../events-list/events-list.component';
import { WindowsService } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { style, animate, transition, trigger, state } from '@angular/animations';
import { EditEventParameters, EventEditComponent } from '../event-edit/event-edit.component';
import { UtilService } from '../../services/util.service';

@Component({
  selector: 'app-window-container',
  standalone: true,
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
  enterAnimationName: string;
  constructor(public windowsService: WindowsService, private utilService: UtilService) {
    this.enterAnimationName = this.utilService.isMobile() ? 'enterFromBottom' : 'enterFromLeft';
  }

  getParameters() {
    return {
      axis: this.utilService.isMobile() ? 'Y' : 'X',
      startPercentage:
        this.utilService.isMobile() || this.windowsService.openingSide === 'left' ? 120 : -120,
    };
  }

  get parameterAsEventList(): EventsListParameters {
    return this.windowsService.parameters as EventsListParameters;
  }

  get parameterAsEventEdit(): EditEventParameters {
    return this.windowsService.parameters as EditEventParameters;
  }
}
