import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { HttpClientModule } from '@angular/common/http';
import { CalendarService } from './services/api/calendar.service';
import { SettingsService } from './services/settings.service';
import { WindowsService } from './windows/windows.service';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { UtilService } from './services/util.service';
import { MobileUtilService } from './services/mobile.util.service';
import { AuthService } from './services/api/auth.service';
import { UserService } from './services/api/user.service';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: 'version',
      useValue: '0.2.1',
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
    importProvidersFrom(HttpClientModule),
    AuthService,
    UserService,
    CalendarService,
    SettingsService,
    WindowsService,
    UtilService,
    MobileUtilService,
  ],
};
