import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './services/api/auth.service';
import { LandingComponent } from './pages/landing/landing.component';

const isLoggedIn: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (!authService.isLoggedIn) inject(Router).navigate(['/']);
  return true;
};

export const routes: Routes = [
  { path: '', component: LandingComponent },
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
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./pages/additional/policy/policy.component').then((m) => m.PolicyComponent),
  },

  // Redirect all other paths to the home page
  { path: '**', redirectTo: '/' },
];
