import { Component, Inject } from '@angular/core';
import { AuthService } from '../../services/api/auth.service';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { IconProp } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'app-login',
  imports: [FontAwesomeModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  googleIcon = faGoogle as IconProp;

  constructor(public authService: AuthService, @Inject(Router) private router: Router) {}

  async login() {
    await this.authService.getAccessTokenAsync();
    this.router.navigate(['/']);
  }
}
