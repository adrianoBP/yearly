import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { NEVER } from 'rxjs';
import { AppComponent } from './app.component';
import { WindowsService } from './windows/windows.service';

describe('AppComponent', () => {
  it('looks for a new version when the app comes back on screen', () => {
    const swUpdate = { isEnabled: true, versionUpdates: NEVER, checkForUpdate: jasmine.createSpy().and.resolveTo(false) };
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: SwUpdate, useValue: swUpdate }, { provide: WindowsService, useValue: {} }],
    });
    TestBed.createComponent(AppComponent);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.visibilityState).toBe('visible');
    expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(1);
  });
});
