import { Injectable } from '@angular/core';
import { SocialUser } from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http';
import { GoogleAuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  constructor(
    private googleAuthService: GoogleAuthService,
    private httpClient: HttpClient
  ) {}

  getGoogleCalendarData(): void {
    if (!this.googleAuthService.accessToken) return;

    this.httpClient
      .get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        headers: {
          Authorization: `Bearer ${this.googleAuthService.accessToken}`,
        },
      })
      .subscribe((events) => {
        console.log('events', events);
      });
  }
}
