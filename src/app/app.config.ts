import { ApplicationConfig, importProvidersFrom, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { CalendarService } from './services/api/calendar.service';
import { SettingsService } from './services/settings.service';
import { WindowsService } from './windows/windows.service';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { UtilService } from './services/util.service';
import { MobileUtilService } from './services/mobile.util.service';
import { AuthService } from './services/api/auth.service';
import { UserService } from './services/api/user.service';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: 'version',
      useValue: '0.3.11',
    },
    {
      provide: 'mockData',
      useValue: false,
    },
    {
      provide: 'googleClientId',
      useValue: '1065910070716-egakej28k19t24psupvnb4a8jpce0e5o.apps.googleusercontent.com',
    },
    {
      provide: 'googleLoginScopes',
      useValue:
        'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
    },
    provideAnimationsAsync(),
    provideRouter(routes),
    provideHttpClient(),
    AuthService,
    UserService,
    CalendarService,
    SettingsService,
    WindowsService,
    UtilService,
    MobileUtilService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: true,
      registrationStrategy: 'registerImmediately',
    }),
  ],
};
