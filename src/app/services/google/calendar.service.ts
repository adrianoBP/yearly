import { Injectable } from '@angular/core';
import {
  SocialAuthService,
  GoogleLoginProvider,
  SocialUser,
} from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  private accessToken = '';

  constructor(
    private socialAuthService: SocialAuthService,
    private httpClient: HttpClient
  ) {}

  getAccessToken(onTokenRetrieved?: () => void): void {
    this.socialAuthService
      .getAccessToken(GoogleLoginProvider.PROVIDER_ID)
      .then((accessToken) => {
        this.accessToken = accessToken;
        if (onTokenRetrieved) onTokenRetrieved();
      });
  }

  getGoogleCalendarData(): void {
    if (!this.accessToken) return;

    this.httpClient
      .get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      .subscribe((events) => {
        console.log('events', events);
      });
  }
}
