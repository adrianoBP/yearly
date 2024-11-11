import { Injectable } from '@angular/core';

@Injectable()
export class MobileUtilService {
  constructor() {}

  isMobile(): boolean {
    return window.innerWidth < 768;
  }

  scrollTodayIntoView(): void {
    const today = new Date();
    const dayId = 'day-' + today.getDate() + '-' + today.getMonth() + '-' + today.getFullYear();
    document.getElementById(dayId)!.scrollIntoView({ behavior: 'smooth' });
  }
}
