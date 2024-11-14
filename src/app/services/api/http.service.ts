import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, lastValueFrom } from 'rxjs';

export type HTTPRequestType = 'get' | 'post' | 'patch' | 'delete';

@Injectable({ providedIn: 'root' })
export class HttpService {
  constructor(private httpClient: HttpClient) {}

  private async webRequest<T>(request: Observable<Object>): Promise<T> {
    try {
      return (await lastValueFrom(request)) as T;
    } catch (err: any) {
      if (err.name == 'HttpErrorResponse') {
        if (err.status == 401) throw 'Unauthorized';
        throw err.error.Message;
      }
      throw err;
    }
  }

  async get<T>(url: string, headers: any = null, tokenValidation?: () => boolean): Promise<T> {
    if (tokenValidation != null && !tokenValidation()) throw 'Invalid token';
    const request = this.httpClient.get(url, { headers });
    return await this.webRequest(request);
  }

  async post<T>(
    url: string,
    headers: any = null,
    body: any = null,
    tokenValidation?: () => boolean
  ): Promise<T> {
    if (tokenValidation != null && !tokenValidation()) throw 'Invalid token';

    // Convert JSON header
    headers['Content-Type'] = 'application/json';

    const request = this.httpClient.post(url, body, { headers });
    return (await this.webRequest(request)) as T;
  }

  async patch<T>(
    url: string,
    headers: any = null,
    body: any = null,
    tokenValidation?: () => boolean
  ): Promise<T> {
    if (tokenValidation != null && !tokenValidation()) throw 'Invalid token';

    // Convert JSON header
    headers['Content-Type'] = 'application/json';

    const request = this.httpClient.patch(url, body, { headers });
    return (await this.webRequest(request)) as T;
  }

  async delete<T>(url: string, headers: any = null, tokenValidation?: () => boolean): Promise<T> {
    if (tokenValidation != null && !tokenValidation()) throw 'Invalid token';
    const request = this.httpClient.delete(url, { headers });
    return await this.webRequest(request);
  }
}
