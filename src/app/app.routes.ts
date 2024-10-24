import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  Routes,
} from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './login/login.component';
import { inject } from '@angular/core';
import { GoogleAuthService } from './services/google/auth.service';
import { MockAuthService } from './services/mock/auth.service';
import { mockData } from './app.config';
import { SettingsComponent } from './pages/settings/settings.component';

const isLoggedIn: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const loggedIn = inject(
    mockData ? MockAuthService : GoogleAuthService
  ).isLoggedIn;
  if (!loggedIn) inject(Router).navigate(['/login']);
  return true;
};

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [isLoggedIn] },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [isLoggedIn],
  },
  { path: 'login', component: LoginComponent },
];
