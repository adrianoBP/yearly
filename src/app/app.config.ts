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

export const mockData = true;

const googleLoginOptions: GoogleInitOptions = {
  oneTapEnabled: true,
  scopes:
    'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
};

export const appConfig: ApplicationConfig = {
  providers: [
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
  ],
};
