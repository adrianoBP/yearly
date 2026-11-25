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
import { WindowsService } from './windows/windows.service';

import { UtilService } from './services/util.service';
import { AuthService } from './services/api/auth.service';
import { UserService } from './services/api/user.service';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: 'version',
      useValue: '1.1.1',
    },
    {
      provide: 'mockData',
      useValue: false,
    },
    {
      // Yearly pass-through on your VPS (server/proxy.mjs), e.g. 'https://yearly-api.example.com'; empty turns off the features that need it
      provide: 'proxyUrl',
      useValue: '',
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
    WindowsService,
    UtilService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
};
