import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  Routes,
} from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { inject } from '@angular/core';
import { GoogleService } from './services/google.service';

const canActivateHome: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const loggedIn = inject(GoogleService).isLoggedIn;
  if (!loggedIn) inject(Router).navigate(['/login']);
  return true;
};

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [canActivateHome] },
  { path: 'login', component: LoginComponent },
];
