import { Component } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { WindowsService } from './windows/windows.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'yearly';

  constructor(swUpdate: SwUpdate, windowsService: WindowsService) {
    // Apply a freshly downloaded deploy now instead of on the next visit.
    swUpdate.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => {
      // Never reload over an open event window: it could drop an unsaved edit. The update then applies next visit.
      if (!windowsService.anyWindowOpen()) {
        document.location.reload();
      }
    });
  }
}
