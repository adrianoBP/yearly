import { CanActivateFn, Router, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { inject } from '@angular/core';
import { SettingsComponent } from './pages/settings/settings.component';
import { AuthService } from './services/api/auth.service';

const isLoggedIn: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (!authService.isLoggedIn) inject(Router).navigate(['/login']);
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
