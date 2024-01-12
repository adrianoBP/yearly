import { Component } from '@angular/core';
import { GoogleService } from '../services/google.service';
import { GoogleSigninButtonModule } from '@abacritt/angularx-social-login';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [GoogleSigninButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  constructor(private googleService: GoogleService) {}

  login() {
    this.googleService.loginWithGoogle();
  }
}
