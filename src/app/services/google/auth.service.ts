import { Injectable } from '@angular/core';
import { ASK_THREAD_KEY } from '../../features/ask';
import { PINS_KEY } from '../../features/countdowns';
import { HTTPRequestType, HttpService } from '../api/http.service';
import { UtilService } from '../util.service';

interface TokenDetails {
  token: string;
  expiryDate: Date;
}

/** What a sign-in started, kept across the trip to Google and back */
interface PendingSignIn {
  state: string;
  /** PKCE: proves to Google that whoever swaps the code is who asked for it */
  verifier: string;
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomText = (bytes: number) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

/**
 * Google sign-in by redirect (no popup). With the Yearly server, Google sends back a code that the server swaps for a
 * long-lived refresh token, so the device stays signed in and gets fresh access tokens without asking
 * (server/yearly-server.mjs, "Staying signed in"). Without it, Google sends an access token that lasts an hour.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  isLoggedIn?: boolean = false;
  /** Why the last sign-in didn't finish, shown on the landing page */
  signInError = '';

  private ACCESS_TOKEN_KEY = 'googleAccessToken';
  /** The Yearly server session's secret, which keeps this device signed in */
  private SESSION_KEY = 'googleSession';
  private PENDING_KEY = 'googleSignIn';
  /** Set for this tab when the server can't keep sign-ins, so the next one asks Google for an hour-long one */
  private NO_SERVER_KEY = 'googleSignInWithoutServer';
  /** Email of the signed-in account (saved by GoogleUserService), so signing in again skips the account picker */
  static readonly LOGIN_HINT_KEY = 'googleLoginHint';
  private tokenDetails: TokenDetails | null = null;
  private session: string | null = localStorage.getItem(this.SESSION_KEY);
  /** Shared by concurrent callers (e.g. several 401s at once) so the token is renewed once */
  private pendingToken: Promise<void> | null = null;

  constructor(
    private httpService: HttpService,
    private utilService: UtilService
  ) {
    try {
      this.tokenDetails = JSON.parse(localStorage.getItem(this.ACCESS_TOKEN_KEY) as string);
    } catch (e) {
      this.tokenDetails = null;
    }

    // A server session renews the token by itself, now or once back online. Without one, an expired token
    // means signing in again, except offline, where the service worker's cache answers the requests
    this.isLoggedIn = this.session != null || (this.tokenDetails != null && (!this.expired || !navigator.onLine));
  }

  /** Also true a minute early, so a request never leaves with a token about to run out */
  private get expired() {
    return this.tokenDetails == null || new Date(this.tokenDetails.expiryDate).getTime() - 60_000 < Date.now();
  }

  /** Sends the page to Google's sign-in, which comes back to / (see completeSignIn) */
  async signIn(): Promise<never> {
    const server = !!this.utilService.serverUrl && !sessionStorage.getItem(this.NO_SERVER_KEY);
    const pending: PendingSignIn = { state: randomText(16), verifier: randomText(32) };
    sessionStorage.setItem(this.PENDING_KEY, JSON.stringify(pending));
    const hint = localStorage.getItem(GoogleAuthService.LOGIN_HINT_KEY);
    const params = new URLSearchParams({
      client_id: this.utilService.googleClientId,
      redirect_uri: `${location.origin}/`,
      scope: this.utilService.googleLoginScopes,
      state: pending.state,
      include_granted_scopes: 'true',
    });
    if (hint) params.set('login_hint', hint);
    if (server) {
      const challenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier));
      params.set('response_type', 'code');
      params.set('access_type', 'offline');
      params.set('code_challenge', base64url(new Uint8Array(challenge)));
      params.set('code_challenge_method', 'S256');
      // Google only hands out a refresh token with consent asked; that's once per device, which then stays signed in
      params.set('prompt', hint ? 'consent' : 'select_account consent');
    } else {
      params.set('response_type', 'token');
      if (!hint) params.set('prompt', 'select_account');
    }
    location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    return new Promise<never>(() => {}); // The page is leaving
  }

  /** Finishes a sign-in that Google redirected back from; runs before the first page is chosen (app.config.ts) */
  async completeSignIn(): Promise<void> {
    const query = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.slice(1));
    const answer = query.has('state') ? query : fragment.has('state') ? fragment : null;
    if (answer == null) return;
    let pending: PendingSignIn | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(this.PENDING_KEY) ?? 'null');
    } catch {
      // Treated as not started here
    }
    sessionStorage.removeItem(this.PENDING_KEY);
    // The code or token mustn't stay in the address bar or the history
    history.replaceState(null, '', location.pathname);
    // Only a sign-in this tab started counts, so another site can't sign the user in to an account of its choosing
    if (pending == null || answer.get('state') !== pending.state) return;

    try {
      const error = answer.get('error');
      if (error) throw error === 'access_denied' ? 'Sign-in was cancelled.' : `Google refused the sign-in (${error}).`;
      const code = answer.get('code');
      if (code == null) {
        this.saveToken(answer.get('access_token') ?? '', Number(answer.get('expires_in')));
      } else {
        const response = await fetch(`${this.utilService.serverUrl}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri: `${location.origin}/`, codeVerifier: pending.verifier }),
        });
        if (response.status === 503) {
          // The server isn't set up to keep sign-ins: ask Google again, for an hour-long one
          sessionStorage.setItem(this.NO_SERVER_KEY, '1');
          await this.signIn();
        }
        if (!response.ok) throw `The Yearly server couldn't finish the sign-in (${response.status}). Try again.`;
        const { session, accessToken, expiresIn } = await response.json();
        this.saveSession(session);
        this.saveToken(accessToken, expiresIn);
      }
      this.isLoggedIn = true;
    } catch (e) {
      this.signInError = typeof e === 'string' ? e : "Couldn't reach the Yearly server to finish the sign-in. Try again.";
    }
  }

  /** A fresh access token: from the server session without asking, otherwise by signing in again */
  getAccessTokenAsync(): Promise<void> {
    this.pendingToken ??= this.renewToken().finally(() => (this.pendingToken = null));
    return this.pendingToken;
  }

  private async renewToken(): Promise<void> {
    if (this.session == null) return this.signIn();
    const response = await fetch(`${this.utilService.serverUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.session}` },
    });
    if (response.status === 401) {
      // Revoked at Google, unused for months, or signed out on the server
      this.saveSession(null);
      return this.signIn();
    }
    if (!response.ok) throw `Couldn't renew the sign-in (${response.status}).`;
    const { accessToken, expiresIn } = await response.json();
    this.saveToken(accessToken, expiresIn);
  }

  private saveToken(token: string, expiresInSeconds: number) {
    this.tokenDetails = { token, expiryDate: new Date(Date.now() + expiresInSeconds * 1000) };
    localStorage.setItem(this.ACCESS_TOKEN_KEY, JSON.stringify(this.tokenDetails));
  }

  private saveSession(session: string | null) {
    this.session = session;
    if (session == null) localStorage.removeItem(this.SESSION_KEY);
    else localStorage.setItem(this.SESSION_KEY, session);
  }

  logOut(): void {
    // Also revokes the refresh token at Google; keepalive lets it finish while the page moves on
    if (this.session)
      fetch(`${this.utilService.serverUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.session}` },
        keepalive: true,
      }).catch(() => {});
    this.saveSession(null);
    this.tokenDetails = null;
    this.isLoggedIn = false;
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    // A deliberate log out shows the account picker next time, to allow switching accounts
    localStorage.removeItem(GoogleAuthService.LOGIN_HINT_KEY);
    // The chat holds calendar details, so it doesn't outlive the account
    localStorage.removeItem(ASK_THREAD_KEY);
    localStorage.removeItem(PINS_KEY);
    // The offline copy of the calendar (ngsw-config.json dataGroup "google") doesn't outlive the account either.
    // Entries are emptied rather than the caches deleted: the running worker keeps its open handles to them.
    globalThis.caches
      ?.keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.includes(':data:google:'))
            .map(async (name) => {
              const cache = await caches.open(name);
              await Promise.all((await cache.keys()).map((request) => cache.delete(request)));
            })
        )
      )
      .catch(() => {});
    navigator.clearAppBadge?.().catch(() => {});
  }

  async makeRequest<T>(
    url: string,
    method: HTTPRequestType,
    body: any = null,
    reAuthorise: boolean = true
  ): Promise<T> {
    // Renewed ahead of time rather than after Google's 401; offline the old token goes, and the cached copy answers
    if (this.session && this.expired && navigator.onLine) await this.getAccessTokenAsync().catch(() => {});
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
