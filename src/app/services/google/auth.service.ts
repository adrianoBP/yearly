import { Injectable } from '@angular/core';
import {
  SocialAuthService,
  GoogleLoginProvider,
  SocialUser,
} from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  public accessToken = '';

  // constructor(private router: Router) {
  //   this.isLoggedIn = true;
  // }
  // getAccessToken(): void {}
  // loginWithGoogle(): void {}
  // logOut(): void {
  //   this.router.navigate(['/login']);
  // }

  constructor(
    private router: Router,
    private socialAuthService: SocialAuthService
  ) {
    this.socialAuthService.authState.subscribe((user) => {
      this.socialUser = user;
      this.isLoggedIn = user != null;

      if (this.isLoggedIn) {
        console.log(this.socialUser);
        this.getAccessToken(() => this.router.navigate(['/']));
      }
    });
  }

  getAccessToken(onTokenRetrieved?: () => void): void {
    this.socialAuthService
      .getAccessToken(GoogleLoginProvider.PROVIDER_ID)
      .then((accessToken) => {
        this.accessToken = accessToken;
        if (onTokenRetrieved) onTokenRetrieved();
      });
  }

  loginWithGoogle(): void {
    this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID);
  }

  logOut(): void {
    this.socialAuthService.signOut();
    this.router.navigate(['/login']);
  }
}
