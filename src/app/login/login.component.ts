import { Component, Injector } from '@angular/core';
import { GoogleAuthService } from '../services/google/auth.service';
import { GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { MockAuthService } from '../services/mock/auth.service';
import { UtilService } from '../services/util.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [GoogleSigninButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  authService: GoogleAuthService | MockAuthService;

  constructor(private injector: Injector, private utilService: UtilService) {
    this.authService = utilService.mockData
      ? this.injector.get(MockAuthService)
      : this.injector.get(GoogleAuthService);
  }

  login() {
    this.authService.loginWithGoogle();
  }
}
