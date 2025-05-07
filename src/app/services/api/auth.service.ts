import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { GoogleAuthService } from '../google/auth.service';
import { MockAuthService } from '../mock/auth.service';
import { UserService } from './user.service';
import { UtilService } from '../util.service';

@Injectable()
export class AuthService {
  constructor(
    private injector: Injector,
    private userService: UserService,
    private router: Router
  ) {
    this.authService = this.injector.get(UtilService).mockData
      ? this.injector.get(MockAuthService)
      : this.injector.get(GoogleAuthService);
  }

  private authService: GoogleAuthService | MockAuthService;

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn || false;
  }

  async getAccessTokenAsync(): Promise<void> {
    if (this.authService.isLoggedIn) return;

    await this.authService.getAccessTokenAsync();
    this.userService.loadUserInfo();
  }

  logOut(): void {
    this.userService.emailAddress = '';
    this.authService.logOut();
    this.router.navigate(['/']);
  }
}
