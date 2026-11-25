import { Injectable } from '@angular/core';
import { FEATURES, featureStatus } from './integrations';
import { IntegrationsService } from './integrations.service';
import { SettingsService } from './settings.service';

/** Whether a feature should show up right now: built, switched on, and its keys (if required) set */
@Injectable()
export class FeaturesService {
  constructor(
    private settingsService: SettingsService,
    private integrations: IntegrationsService
  ) {}

  status(id: string) {
    const feature = FEATURES.find((f) => f.id === id)!;
    const enabled = this.settingsService.getSettings().features?.[id] ?? true;
    return featureStatus(feature, enabled, this.integrations.canUse);
  }

  isOn(id: string) {
    const status = this.status(id);
    return status === 'ready' || status === 'basic';
  }
}
