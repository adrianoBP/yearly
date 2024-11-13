import { Component } from '@angular/core';
import { GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [GoogleSigninButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  constructor(public authService: AuthService) {}

  login() {
    this.authService.loginWithGoogle();
  }
}
