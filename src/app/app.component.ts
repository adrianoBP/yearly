import { Component, HostListener } from '@angular/core';

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

  private readonly reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /** A ripple spreads from where any button is pressed (styles in styles.css) */
  @HostListener('document:pointerdown', ['$event'])
  ripple(event: PointerEvent) {
    const target = (event.target as Element)?.closest?.<HTMLElement>('.btn, .icon-btn, .chip, .get-key, .menu button');
    if (target == null || target.matches(':disabled') || this.reduceMotion.matches) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`;
    ripple.addEventListener('animationend', () => ripple.remove());
    target.appendChild(ripple);
  }

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
