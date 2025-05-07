import { Component, Inject } from '@angular/core';
import { AuthService } from '../../services/api/auth.service';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { IconProp } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'app-landing',
  imports: [FontAwesomeModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  googleIcon = faGoogle as IconProp;

  constructor(public authService: AuthService, @Inject(Router) private router: Router) {}

  ngOnInit() {
    if (this.authService.isLoggedIn) this.router.navigate(['/']);
  }

  async login() {
    await this.authService.getAccessTokenAsync();
    this.router.navigate(['/home']);
  }
}
