import { Component } from '@angular/core';
import { EventsListComponent } from '../events-list/events-list.component';
import { WindowsService } from '../windows.service';
import { EventEditComponent } from '../event-edit/event-edit.component';
import { SettingsService } from '../../services/settings.service';
import { LeavePlannerComponent } from '../leave-planner/leave-planner.component';
import { YearReviewComponent } from '../year-review/year-review.component';

@Component({
  selector: 'app-window-container',
  imports: [EventsListComponent, EventEditComponent, LeavePlannerComponent, YearReviewComponent],
  templateUrl: './window-container.component.html',
  styleUrl: './window-container.component.css',
})
export class WindowContainerComponent {
  // Side of the first window; later windows stack on top of it
  readonly side = this.windowsService.getOpenedWindow()?.side ?? 'left';

  constructor(
    public windowsService: WindowsService,
    public settingService: SettingsService
  ) {}

  onBackdropClick() {
    if (this.settingService.getSettings().closeAllWindows) this.windowsService.backAllWindows();
    else this.windowsService.back();
  }
}
