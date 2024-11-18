import { Injectable } from '@angular/core';
import { SuccessTokenResponse } from 'google-oauth-gsi';

@Injectable({ providedIn: 'root' })
export class MockAuthService {
  isLoggedIn?: boolean = true;

  constructor() {}

  getAccessTokenAsync(): Promise<SuccessTokenResponse> {
    return new Promise((resolve) => {
      resolve({} as SuccessTokenResponse);
    });
  }

  loginWithGoogle(): void {}

  logOut(): void {}
}
