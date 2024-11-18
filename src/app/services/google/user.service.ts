import { Injectable } from '@angular/core';
import { GoogleAuthService } from './auth.service';
import { User } from '../api/user.service';

@Injectable({ providedIn: 'root' })
export class GoogleUserService {
  constructor(private googleAuthService: GoogleAuthService) {}

  private baseUrl = 'https://www.googleapis.com/oauth2/v2';

  async getUserInfo(): Promise<User> {
    const url = `${this.baseUrl}/userinfo `;
    const response = await this.googleAuthService.makeRequest<User>(url, 'get');
    return response;
  }
}
