import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, lastValueFrom } from 'rxjs';

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

  async get<T>(
    url: string,
    headers: any = null,
    tokenValidation?: () => boolean
  ): Promise<T> {
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

    // Convert JSON to form data
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const formBody = [];
    for (const property in body) {
      const encodedKey = encodeURIComponent(property);
      const encodedValue = encodeURIComponent(body[property]);
      formBody.push(encodedKey + '=' + encodedValue);
    }
    body = formBody.join('&');

    const request = this.httpClient.post(url, body, { headers });
    return (await this.webRequest(request)) as T;
  }
}
