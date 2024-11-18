import { Injectable, Injector } from '@angular/core';
import { UtilService } from '../util.service';
import { MockUserService } from '../mock/user.service';
import { GoogleUserService } from '../google/user.service';

export interface User {
  email: string;
}

@Injectable()
export class UserService {
  constructor(private injector: Injector, private utilService: UtilService) {
    this.userService = utilService.mockData
      ? this.injector.get(MockUserService)
      : this.injector.get(GoogleUserService);

    this.loadUserInfo();
  }

  private userService: GoogleUserService | MockUserService;

  emailAddress: string = '';

  async loadUserInfo(): Promise<void> {
    const user = await this.userService.getUserInfo();
    this.emailAddress = user!.email;
  }
}
