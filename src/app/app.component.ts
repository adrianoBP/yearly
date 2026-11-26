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
    const target = (event.target as Element)?.closest?.<HTMLElement>('.btn, .icon-btn, .chip, .ext-link, .menu button');
    if (target == null || target.matches(':disabled') || this.reduceMotion.matches) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`;
    ripple.addEventListener('animationend', () => ripple.remove());
    target.appendChild(ripple);
  }

  /** Height of the on-screen keyboard as --keyboard, for bottom sheets (window-container.component.css).
   *  Android resizes the page for the keyboard (viewport meta interactive-widget), so it stays 0 there; iOS doesn't. */
  private trackKeyboard() {
    const viewport = window.visualViewport;
    if (viewport == null) return;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const keyboard = Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop));
      document.documentElement.style.setProperty('--keyboard', `${keyboard}px`);
    };
    viewport.addEventListener('scroll', update);
    viewport.addEventListener('resize', () => {
      update();
      // Keyboard opened: once the sheet has moved up (its transition is 0.25s), bring the focused field back into view.
      // Only on resize, never on scroll, so it can't fight the user scrolling.
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => document.activeElement?.closest('[role="dialog"]') &&
        document.activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 260);
    });
  }

  /** Phones keep the app in the background instead of restarting it, so look for a new deploy whenever it's back on screen */
  @HostListener('document:visibilitychange')
  checkForUpdate() {
    if (document.visibilityState === 'visible' && this.swUpdate.isEnabled) this.swUpdate.checkForUpdate().catch(() => {});
  }

  constructor(private swUpdate: SwUpdate, windowsService: WindowsService) {
    this.trackKeyboard();
    // Apply a freshly downloaded deploy now instead of on the next visit.
    swUpdate.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => {
      // Never reload over an open event window: it could drop an unsaved edit. The update then applies next visit.
      if (!windowsService.anyWindowOpen()) {
        document.location.reload();
      }
    });
  }
}
