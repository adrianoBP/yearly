import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './services/api/auth.service';
import { LandingComponent } from './pages/landing/landing.component';

// Redirects happen before anything renders, so a signed-in start never shows the landing page first
const isLoggedIn: CanActivateFn = () => inject(AuthService).isLoggedIn || inject(Router).createUrlTree(['/']);
const isLoggedOut: CanActivateFn = () => !inject(AuthService).isLoggedIn || inject(Router).createUrlTree(['/home']);

export const routes: Routes = [
  { path: '', component: LandingComponent, canActivate: [isLoggedOut] },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    canActivate: [isLoggedIn],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [isLoggedIn],
  },

  // Redirect all other paths to the home page
  { path: '**', redirectTo: '/' },
];
