import { Injectable } from '@angular/core';
import { SocialUser } from '@abacritt/angularx-social-login';

@Injectable({ providedIn: 'root' })
export class MockAuthService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean = true;

  constructor() {}

  getAccessToken(forceReload?: boolean, onTokenRetrieved?: () => void): void {}

  getAccessTokenAsync(forceReload?: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  loginWithGoogle(): void {}

  logOut(): void {}
}
