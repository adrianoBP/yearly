import { CanActivateFn, Router, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { inject } from '@angular/core';
import { SettingsComponent } from './pages/settings/settings.component';
import { AuthService } from './services/api/auth.service';
import { PolicyComponent } from './pages/additional/policy/policy.component';
import { LandingComponent } from './pages/landing/landing.component';

const isLoggedIn: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (!authService.isLoggedIn) inject(Router).navigate(['/']);
  return true;
};

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'home', component: HomeComponent, canActivate: [isLoggedIn] },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [isLoggedIn],
  },
  { path: 'privacy-policy', component: PolicyComponent },

  // Redirect all other paths to the home page
  { path: '**', redirectTo: '/' },
];
