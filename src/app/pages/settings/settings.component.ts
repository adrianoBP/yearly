import { Component, isDevMode } from '@angular/core';
import { CalendarService } from '../../services/api/calendar.service';

import { GoogleCalendar } from '../../services/google/calendar.service';
import { Settings, SettingsService } from '../../services/settings.service';
import { UtilService } from '../../services/util.service';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/api/user.service';
import {
  faArrowLeft,
  faArrowUpRightFromSquare,
  faCake,
  faInfinity,
} from '@fortawesome/free-solid-svg-icons';
import { faCalendarXmark } from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DatePipe, DecimalPipe } from '@angular/common';
import { IntegrationsService } from '../../services/integrations.service';
import { SyncService } from '../../services/sync.service';
import { NotificationsService, PushState } from '../../services/notifications.service';
import {
  FEATURES,
  Feature,
  FeatureStatus,
  PROVIDERS,
  ProviderId,
  canToggle,
  featureStatus,
  missingKeys,
} from '../../services/integrations';

const STATUS_LABELS: Record<Exclude<FeatureStatus, 'needs-key'>, string> = {
  soon: 'Coming soon',
  off: 'Off',
  ready: 'Ready',
  basic: 'Basic',
};

type toggleSettingType = 'allowed' | 'recurring' | 'birthdays' | 'declined-events';

@Component({
  selector: 'app-settings',
  imports: [FontAwesomeModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  constructor(
    public calendarService: CalendarService,
    public settingsService: SettingsService,
    public utilService: UtilService,
    public userService: UserService,
    public integrations: IntegrationsService,
    public sync: SyncService,
    public notifications: NotificationsService
  ) {}

  // ---- Notifications on this device ----

  pushBusy = false;
  pushMessage = '';
  pushError = false;

  pushLabel(state: PushState): string {
    return { 'no-server': 'Needs the Yearly server', unsupported: 'Not available here', blocked: 'Blocked', off: 'Off', on: 'Ready' }[state];
  }

  async togglePush(input: HTMLInputElement) {
    this.pushBusy = true;
    this.pushMessage = '';
    this.pushError = false;
    try {
      if (this.notifications.state === 'on') await this.notifications.disable();
      else {
        await this.notifications.enable();
        this.pushMessage = 'On. Alerts are worked out each time Yearly opens on this device.';
      }
    } catch (e) {
      this.pushError = true;
      this.pushMessage =
        typeof e === 'string' ? e : this.notifications.state === 'blocked' ? 'Notifications are blocked for Yearly.' : "Couldn't turn notifications on.";
    } finally {
      this.pushBusy = false;
      // A refused permission leaves the state as it was, so put the switch back
      input.checked = this.notifications.state === 'on';
    }
  }

  async testPush() {
    this.pushBusy = true;
    this.pushError = false;
    try {
      await this.notifications.test();
      this.pushMessage =
        "Test sent. It should appear in a few seconds. If it doesn't, check that notifications are on for this browser in your device's settings, and that Do not disturb is off.";
    } catch (e) {
      this.pushError = true;
      this.pushMessage = String(e);
    } finally {
      this.pushBusy = false;
    }
  }

  /** ng serve without the production configuration: no service worker, so no notifications */
  devMode = isDevMode();

  features = FEATURES;
  canToggle = canToggle;
  providers = PROVIDERS;
  /** Result of the last Test per provider */
  testResults: Partial<Record<ProviderId, { ok: boolean; message: string }>> = {};
  testing: Partial<Record<ProviderId, boolean>> = {};

  isFeatureOn(feature: Feature) {
    return this.settings.features?.[feature.id] ?? true;
  }

  toggleFeature(feature: Feature) {
    this.settings.features = { ...this.settings.features, [feature.id]: !this.isFeatureOn(feature) };
    this.settingsService.setSettings(this.settings);
  }

  getFeatureStatus(feature: Feature) {
    return featureStatus(feature, this.isFeatureOn(feature), this.integrations.canUse);
  }

  getStatusLabel(feature: Feature) {
    const status = this.getFeatureStatus(feature);
    if (status !== 'needs-key') return STATUS_LABELS[status];
    const names = missingKeys(feature, this.integrations.canUse).map((group) =>
      group.map((id) => this.providers.find((p) => p.id === id)!.name).join(' or ')
    );
    return `Needs ${names.join(' and ')} key`;
  }

  /** Features that use this provider's key, for the "Used for" line */
  usedFor(id: ProviderId) {
    return this.features
      .filter((f) => [...f.keys, ...(f.optionalKeys ?? [])].some((group) => group.includes(id)))
      .map((f) => f.name)
      .join(', ');
  }

  saveHomeAddress(value: string) {
    this.settings.homeAddress = value.trim() || undefined;
    this.settingsService.setSettings(this.settings);
  }

  saveKey(id: ProviderId, value: string) {
    if (value.trim() === (this.integrations.getKey(id) ?? '')) return;
    this.integrations.setKey(id, value);
    delete this.testResults[id];
  }

  removeKey(id: ProviderId) {
    this.integrations.setKey(id, '');
    delete this.testResults[id];
  }

  async testKey(id: ProviderId) {
    this.testing[id] = true;
    try {
      await this.integrations.test(id);
      this.testResults[id] = { ok: true, message: 'Key works.' };
    } catch (message) {
      this.testResults[id] = { ok: false, message: String(message) };
    } finally {
      this.testing[id] = false;
    }
  }

  declineEventIcon = faCalendarXmark;
  infinityIcon = faInfinity;
  cakeIcon = faCake;
  backIcon = faArrowLeft;
  externalIcon = faArrowUpRightFromSquare;

  calendars: GoogleCalendar[] = [];
  settings: Settings = {
    calendars: [],
  };

  async ngOnInit() {
    this.sync.start();
    this.calendars = await this.calendarService.getCalendars();
    this.settings = this.settingsService.getSettings();

    // Add calendar to settings if missing
    for (const calendar of this.calendars) {
      const calendarSettings = this.settings.calendars.find((cal) => cal.id === calendar.id);
      if (calendarSettings == null)
        this.settings.calendars.push({
          id: calendar.id,
          allowed: false,
          allowRecurring: false,
          allowBirthdays: false,
          showDeclinedEvents: false,
        });
    }
  }

  isCalendarAllowed(calendarId: string) {
    return this.settings.calendars.find((cal) => cal.id === calendarId)?.allowed ?? false;
  }

  getCalendarSettings(calendarId: string) {
    return this.settings.calendars.find((cal) => cal.id === calendarId);
  }

  toggleSetting(calendarId: string, setting: toggleSettingType) {
    const calendar = this.settings.calendars.find((cal) => cal.id === calendarId);
    if (calendar == null) return;

    switch (setting) {
      case 'allowed':
        calendar.allowed = !calendar.allowed;
        break;
      case 'recurring':
        calendar.allowRecurring = !calendar.allowRecurring;
        break;
      case 'birthdays':
        calendar.allowBirthdays = !calendar.allowBirthdays;
        break;
      case 'declined-events':
        calendar.showDeclinedEvents = !calendar.showDeclinedEvents;
        break;
    }

    this.settingsService.setSettings(this.settings);
  }
}
