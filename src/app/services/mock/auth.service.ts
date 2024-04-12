import { Injectable } from '@angular/core';
import { SocialUser } from '@abacritt/angularx-social-login';

@Injectable({ providedIn: 'root' })
export class MockAuthService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean = true;

  constructor() {
    this.socialUser = {
      id: '123',
      name: 'Mock User',
      email: '',
      photoUrl: '',
      firstName: 'Mock',
      lastName: 'User',
      authToken: '123',
      idToken: '123',
      provider: 'mockingService',
      authorizationCode: '123',
      response: {},
    };
  }

  getAccessToken(forceReload?: boolean, onTokenRetrieved?: () => void): void {}

  getAccessTokenAsync(forceReload?: boolean): Promise<void> {
    return new Promise((resolve) => {
      resolve();
    });
  }

  loginWithGoogle(): void {}

  logOut(): void {}
}
