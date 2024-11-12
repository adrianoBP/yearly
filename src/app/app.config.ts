import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {
  GoogleInitOptions,
  GoogleLoginProvider,
  SocialAuthServiceConfig,
} from '@abacritt/angularx-social-login';
import { HttpClientModule } from '@angular/common/http';
import { CalendarService } from './services/calendar.service';
import { SettingsService } from './services/settings.service';
import { WindowsService } from './windows/windows.service';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { UtilService } from './services/util.service';
import { MobileUtilService } from './services/mobile.util.service';

const googleLoginOptions: GoogleInitOptions = {
  oneTapEnabled: true,
  scopes:
    'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
};

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: 'version',
      useValue: '0.1.4',
    },
    {
      provide: 'mockData',
      useValue: false,
    },
    provideAnimationsAsync(),
    provideRouter(routes),
    importProvidersFrom(HttpClientModule),
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: true,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              '1065910070716-egakej28k19t24psupvnb4a8jpce0e5o.apps.googleusercontent.com',
              googleLoginOptions
            ),
          },
        ],
      } as SocialAuthServiceConfig,
    },
    CalendarService,
    SettingsService,
    WindowsService,
    UtilService,
    MobileUtilService,
  ],
};
