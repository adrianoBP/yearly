import { Injectable, inject } from '@angular/core';
import {
  SocialAuthService,
  GoogleLoginProvider,
  SocialUser,
} from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class GoogleService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  constructor(
    private router: Router,
    private socialAuthService: SocialAuthService
  ) {
    this.socialAuthService.authState.subscribe((user) => {
      this.socialUser = user;
      this.isLoggedIn = user != null;
      console.log(this.socialUser);

      if (this.isLoggedIn) this.router.navigate(['/']);
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
