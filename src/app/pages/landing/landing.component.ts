import { Component, Inject } from '@angular/core';
import { AuthService } from '../../services/api/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  constructor(public authService: AuthService, @Inject(Router) private router: Router) {}

  async login() {
    await this.authService.getAccessTokenAsync();
    this.router.navigate(['/home']);
  }
}
