import { Injectable } from '@angular/core';
import {
  SocialAuthService,
  GoogleLoginProvider,
  SocialUser,
  GoogleInitOptions,
} from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';
import { GoogleCalendarService } from './calendar.service';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  constructor(
    private router: Router,
    private socialAuthService: SocialAuthService,
    private googleCalendarService: GoogleCalendarService
  ) {
    this.socialAuthService.authState.subscribe((user) => {
      this.socialUser = user;
      this.isLoggedIn = user != null;
      console.log(this.socialUser);

      if (this.isLoggedIn) {
        this.googleCalendarService.getAccessToken(() =>
          this.router.navigate(['/'])
        );
      }
    });
  }

  get isAuthorised() {
    return true;
  }

  loginWithGoogle(): void {
    this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID);
  }

  logOut(): void {
    this.socialAuthService.signOut();
    this.router.navigate(['/login']);
  }
}
