import { Injectable, Injector } from '@angular/core';
import { UtilService } from './util.service';
import { MockAuthService } from './mock/auth.service';
import { GoogleAuthService } from './google/auth.service';

@Injectable()
export class AuthService {
  constructor(private injector: Injector, private utilService: UtilService) {
    this.authService = utilService.mockData
      ? this.injector.get(MockAuthService)
      : this.injector.get(GoogleAuthService);
  }

  private authService: GoogleAuthService | MockAuthService;

  getAccessToken(forceReload?: boolean, onTokenRetrieved?: () => void): void {
    this.authService.getAccessToken(forceReload, onTokenRetrieved);
  }

  getAccessTokenAsync(forceReload?: boolean): Promise<void> {
    return this.authService.getAccessTokenAsync(forceReload);
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  logOut(): void {
    this.authService.logOut();
  }

  get socialUser() {
    return this.authService.socialUser;
  }
}
