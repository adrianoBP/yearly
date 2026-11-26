import { ApplicationConfig, isDevMode } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withPreloading,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { CalendarService } from './services/api/calendar.service';
import { SettingsService } from './services/settings.service';
import { IntegrationsService } from './services/integrations.service';
import { SyncService } from './services/sync.service';
import { FeaturesService } from './services/features.service';
import { WeatherService } from './services/weather.service';
import { LiveService } from './services/live.service';
import { CountdownsService } from './services/countdowns.service';
import { NotificationsService } from './services/notifications.service';
import { WindowsService } from './windows/windows.service';

import { UtilService } from './services/util.service';
import { AuthService } from './services/api/auth.service';
import { UserService } from './services/api/user.service';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

// Set when building for release (ng build --define, see .github/workflows/deploy.yml), so neither lives in the repository
declare const YEARLY_VERSION: string | undefined;
declare const YEARLY_SERVER_URL: string | undefined;

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: 'version',
      useValue: typeof YEARLY_VERSION !== 'undefined' ? YEARLY_VERSION : '0.0.0-dev',
    },
    {
      provide: 'mockData',
      useValue: false,
    },
    {
      // Yearly server at https://api.<your app's domain> (server/README.md); empty turns off the features that need it.
      // Without a release build, the app looks for one running on this computer.
      provide: 'serverUrl',
      useValue:
        typeof YEARLY_SERVER_URL !== 'undefined' ? YEARLY_SERVER_URL : location.hostname === 'localhost' ? 'http://localhost:8787' : '',
    },
    {
      provide: 'googleClientId',
      useValue: '1065910070716-egakej28k19t24psupvnb4a8jpce0e5o.apps.googleusercontent.com',
    },
    {
      provide: 'googleLoginScopes',
      useValue:
        'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.appdata',
    },
    provideRouter(routes, withPreloading(PreloadAllModules), withViewTransitions()),
    provideHttpClient(),
    AuthService,
    UserService,
    CalendarService,
    SettingsService,
    IntegrationsService,
    SyncService,
    FeaturesService,
    WeatherService,
    LiveService,
    CountdownsService,
    NotificationsService,
    WindowsService,
    UtilService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
};
