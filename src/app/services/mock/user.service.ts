import { Injectable } from '@angular/core';
import { User } from '../api/user.service';

@Injectable({ providedIn: 'root' })
export class MockUserService {
  constructor() {}

  async getUserInfo(): Promise<User> {
    return {
      email: 'adriano.boccardo@gmail.com',
    } as User;
  }
}
