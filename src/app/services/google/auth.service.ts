import { Injectable } from '@angular/core';
import {
  SocialAuthService,
  GoogleLoginProvider,
  SocialUser,
} from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';
import { HTTPRequestType, HttpService } from '../http.service';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  socialUser?: SocialUser;
  isLoggedIn?: boolean;

  private ACCESS_TOKEN_KEY = 'googleAccessToken';
  private accessToken = '';

  // constructor(private router: Router, private httpService: HttpService) {
  //   this.isLoggedIn = true;
  //   this.getAccessToken();
  // }
  // getAccessToken(onTokenRetrieved?: () => void): void {
  //   if (localStorage.getItem(this.ACCESS_TOKEN_KEY) != null) {
  //     this.accessToken = localStorage.getItem(this.ACCESS_TOKEN_KEY) as string;
  //     if (onTokenRetrieved) onTokenRetrieved();
  //     return;
  //   }
  // }
  // getAccessTokenAsync(params: any): Promise<void> {
  //   return new Promise((resolve, reject) => {
  //     resolve();
  //   });
  // }
  // loginWithGoogle(): void {}
  // logOut(): void {
  //   this.router.navigate(['/login']);
  // }

  constructor(
    private router: Router,
    private httpService: HttpService,
    private socialAuthService: SocialAuthService
  ) {
    this.socialAuthService.authState.subscribe((user) => {
      this.socialUser = user;
      this.isLoggedIn = user != null;

      this.accessToken = localStorage.getItem(this.ACCESS_TOKEN_KEY) as string;

      if (this.isLoggedIn) {
        console.log(this.socialUser);
        this.getAccessToken(false, () => this.router.navigate(['/']));
      }
    });
  }

  getAccessToken(forceReload?: boolean, onTokenRetrieved?: () => void): void {
    if (this.accessToken != '' && !forceReload && onTokenRetrieved) {
      onTokenRetrieved();
      return;
    }

    this.socialAuthService
      .getAccessToken(GoogleLoginProvider.PROVIDER_ID)
      .then((accessToken) => {
        this.accessToken = accessToken;
        console.log(this.accessToken);
        localStorage.setItem(this.ACCESS_TOKEN_KEY, this.accessToken);
        if (onTokenRetrieved) onTokenRetrieved();
      });
  }

  getAccessTokenAsync(forceReload?: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.accessToken != '' && !forceReload) {
        resolve();
        return;
      }

      this.socialAuthService
        .getAccessToken(GoogleLoginProvider.PROVIDER_ID)
        .then((accessToken) => {
          this.accessToken = accessToken;
          console.log(this.accessToken);
          localStorage.setItem(this.ACCESS_TOKEN_KEY, this.accessToken);
          resolve();
        })
        .catch((err) => reject(err));
    });
  }

  loginWithGoogle(): void {
    this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID);
  }

  logOut(): void {
    this.socialAuthService.signOut();
    this.router.navigate(['/login']);
  }

  async makeRequest<T>(
    url: string,
    method: HTTPRequestType,
    reAuthorise: boolean = true
  ): Promise<T> {
    switch (method) {
      case 'get':
        return await this.authWrapper<Promise<T>>(
          async (): Promise<T> =>
            await this.httpService.get<T>(url, {
              Authorization: `Bearer ${this.accessToken}`,
            }),
          reAuthorise
        );
      case 'post':
        return await this.httpService.post<T>(url, {
          Authorization: `Bearer ${this.accessToken}`,
        });
      default:
        throw 'Invalid HTTP request type';
    }
  }

  /**
   * If the API request returns 'Unauthorized', gets a new access token and tries again.
   */
  private async authWrapper<T>(
    callback: () => T,
    reAuthorise: boolean = true
  ): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      console.log(error);
      if (error === 'Unauthorized' && reAuthorise) {
        await this.getAccessTokenAsync(true);
        return await callback();
      }
      throw error;
    }
  }
}
