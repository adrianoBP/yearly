import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MockAuthService {
  isLoggedIn?: boolean = true;
  signInError = '';

  constructor() {}

  async completeSignIn(): Promise<void> {}

  async getAccessTokenAsync(): Promise<void> {}

  loginWithGoogle(): void {}

  logOut(): void {}
}
