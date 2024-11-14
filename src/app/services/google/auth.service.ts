import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HTTPRequestType, HttpService } from '../api/http.service';

import { GoogleOAuthProvider, SuccessTokenResponse } from 'google-oauth-gsi';
import { UtilService } from '../util.service';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  isLoggedIn?: boolean = false;

  private ACCESS_TOKEN_KEY = 'googleAccessToken';
  private accessToken = '';

  googleProvider: GoogleOAuthProvider;

  constructor(
    private router: Router,
    private httpService: HttpService,
    private utilService: UtilService
  ) {
    this.googleProvider = new GoogleOAuthProvider({
      clientId: utilService.googleClientId,
      onScriptLoadError: () => console.log('onScriptLoadError'),
      onScriptLoadSuccess: () => console.log('onScriptLoadSuccess'),
    });

    this.accessToken = localStorage.getItem(this.ACCESS_TOKEN_KEY) as string;

    if (this.accessToken == null || this.accessToken == '') {
      this.getAccessToken(() => this.router.navigate(['/']));
    } else {
      // TODO: check token expiry
      this.isLoggedIn = true;
      this.router.navigate(['/']);
    }
  }

  async getAccessToken(onTokenRetrieved?: () => void): Promise<void> {
    await this.getAccessTokenAsync();
    if (onTokenRetrieved) onTokenRetrieved();
  }

  getAccessTokenAsync(onTokenRetrieved?: () => void): Promise<SuccessTokenResponse> {
    return new Promise((resolve, reject) => {
      this.googleProvider.useGoogleLogin({
        flow: 'implicit',
        scope: this.utilService.googleLoginScopes,
        onSuccess: (res) => {
          this.accessToken = res.access_token;
          localStorage.setItem(this.ACCESS_TOKEN_KEY, this.accessToken);
          this.isLoggedIn = true;
          if (onTokenRetrieved) onTokenRetrieved();
          resolve(res);
        },
        onError: (err) => reject(err),
      })();
    });
  }

  logOut(): void {
    this.accessToken = '';
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
  }

  async makeRequest<T>(
    url: string,
    method: HTTPRequestType,
    body: any = null,
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
        return await this.authWrapper<Promise<T>>(
          async (): Promise<T> =>
            await this.httpService.post<T>(
              url,
              {
                Authorization: `Bearer ${this.accessToken}`,
              },
              body
            ),
          reAuthorise
        );
      case 'patch':
        return await this.authWrapper<Promise<T>>(
          async (): Promise<T> =>
            await this.httpService.patch<T>(
              url,
              {
                Authorization: `Bearer ${this.accessToken}`,
              },
              body
            ),
          reAuthorise
        );
      case 'delete':
        return await this.authWrapper<Promise<T>>(
          async (): Promise<T> =>
            await this.httpService.delete<T>(url, {
              Authorization: `Bearer ${this.accessToken}`,
            }),
          reAuthorise
        );
      default:
        throw 'Invalid HTTP request type';
    }
  }

  /**
   * If the API request returns 'Unauthorized', gets a new access token and tries again.
   */
  private async authWrapper<T>(callback: () => T, reAuthorise: boolean = true): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      console.log(error);
      if (error === 'Unauthorized' && reAuthorise) {
        await this.getAccessTokenAsync();
        return await callback();
      }
      throw error;
    }
  }
}
