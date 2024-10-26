import { Component } from '@angular/core';
import { EventsListComponent } from '../events-list/events-list.component';
import { WindowsService } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { style, animate, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-window-container',
  standalone: true,
  imports: [CommonModule, FormsModule, EventsListComponent],
  templateUrl: './window-container.component.html',
  styleUrl: './window-container.component.css',
  animations: [
    trigger('swipeIn', [
      transition(':enter', [
        style({ transform: 'translate{{axis}}({{startPercentage}}%)' }),
        animate('100ms', style({ transform: 'translate{{axis}}(0)' })),
      ]),
    ]),
  ],
})
export class WindowContainerComponent {
  enterAnimationName: string;
  constructor(public windowsService: WindowsService) {
    this.enterAnimationName = this.isMobile() ? 'enterFromBottom' : 'enterFromLeft';
  }

  isMobile(): boolean {
    return window.innerWidth < 768;
  }

  getParameters() {
    return {
      axis: this.isMobile() ? 'Y' : 'X',
      startPercentage: this.isMobile() || this.windowsService.openingSide === 'left' ? 100 : -100,
    };
  }
}
