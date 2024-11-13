import { ActivatedRouteSnapshot, CanActivateFn, Router, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { inject } from '@angular/core';
import { GoogleAuthService } from './services/google/auth.service';
import { MockAuthService } from './services/mock/auth.service';
import { SettingsComponent } from './pages/settings/settings.component';
import { UtilService } from './services/util.service'; // Import utilService

const isLoggedIn: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const mockData = inject(UtilService).mockData;
  const loggedIn = inject(mockData ? MockAuthService : GoogleAuthService).isLoggedIn;
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
