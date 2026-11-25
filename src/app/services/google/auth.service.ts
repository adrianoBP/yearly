import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { HTTPRequestType, HttpService } from '../api/http.service';

import { GoogleOAuthProvider, SuccessTokenResponse } from 'google-oauth-gsi';
import { UtilService } from '../util.service';

interface TokenDetails {
  token: string;
  expiryDate: Date;
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  isLoggedIn?: boolean = false;

  private ACCESS_TOKEN_KEY = 'googleAccessToken';
  private tokenDetails: TokenDetails | null = null;

  googleProvider!: GoogleOAuthProvider;
  /** Resolves once Google's sign-in script has loaded; before that, login calls are no-ops */
  private scriptReady: Promise<void>;
  /** Shared by concurrent callers (e.g. several 401s at once) so only one popup opens */
  private pendingLogin: Promise<SuccessTokenResponse> | null = null;

  constructor(
    private router: Router,
    private httpService: HttpService,
    private utilService: UtilService,
    private ngZone: NgZone
  ) {
    this.scriptReady = new Promise((resolve, reject) => {
      this.googleProvider = new GoogleOAuthProvider({
        clientId: utilService.googleClientId,
        onScriptLoadError: () => reject('Google sign-in script failed to load'),
        onScriptLoadSuccess: () => resolve(),
      });
    });
    this.scriptReady.catch(console.error);

    try {
      this.tokenDetails = JSON.parse(localStorage.getItem(this.ACCESS_TOKEN_KEY) as string);
    } catch (e) {
      this.tokenDetails = null;
    }

    // No valid token: stay logged out, the landing page asks the user to sign in
    if (this.tokenDetails == null || new Date(this.tokenDetails.expiryDate) < new Date()) return;

    // Login
    this.isLoggedIn = true;
    this.router.navigate(['/']);
  }

  getAccessTokenAsync(): Promise<SuccessTokenResponse> {
    this.pendingLogin ??= this.requestToken().finally(() => (this.pendingLogin = null));
    return this.pendingLogin;
  }

  private async requestToken(): Promise<SuccessTokenResponse> {
    await this.scriptReady;
    return new Promise((resolve, reject) => {
      // Google calls back outside Angular's zone; re-enter it so the app re-renders without an extra click
      this.googleProvider.useGoogleLogin({
        flow: 'implicit',
        scope: this.utilService.googleLoginScopes,
        onSuccess: (res) =>
          this.ngZone.run(() => {
            this.tokenDetails = {
              token: res.access_token,
              expiryDate: new Date(Date.now() + res.expires_in * 1000),
            };
            localStorage.setItem(this.ACCESS_TOKEN_KEY, JSON.stringify(this.tokenDetails));
            this.isLoggedIn = true;
            resolve(res);
          }),
        onError: (err) => this.ngZone.run(() => reject(err)),
        // e.g. the popup was closed or blocked
        onNonOAuthError: (err) => this.ngZone.run(() => reject(err)),
      })();
    });
  }

  logOut(): void {
    this.tokenDetails = null;
    this.isLoggedIn = false;
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
              Authorization: `Bearer ${this.tokenDetails?.token}`,
            }),
          reAuthorise
        );
      case 'post':
        return await this.authWrapper<Promise<T>>(
          async (): Promise<T> =>
            await this.httpService.post<T>(
              url,
              {
                Authorization: `Bearer ${this.tokenDetails?.token}`,
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
                Authorization: `Bearer ${this.tokenDetails?.token}`,
              },
              body
            ),
          reAuthorise
        );
      case 'delete':
        return await this.authWrapper<Promise<T>>(
          async (): Promise<T> =>
            await this.httpService.delete<T>(url, {
              Authorization: `Bearer ${this.tokenDetails?.token}`,
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
