import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';
import { Bridge, Holiday, NagerHoliday, findBridges, holidaysFor } from '../../features/leave-planner';
import { IntegrationsService } from '../../services/integrations.service';
import { Settings, SettingsService, homeCountry } from '../../services/settings.service';
import { WindowParameters, WindowsService } from '../windows.service';

export type LeavePlannerParameters = WindowParameters;

const NAGER = 'https://date.nager.at/api/v3';
const MONTH = 30 * 24 * 60 * 60 * 1000;
// shortcut: Nager.Date gives region codes only; names for the UK nations, other countries show the code
const REGION_NAMES: Record<string, string> = {
  'GB-ENG': 'England',
  'GB-NIR': 'Northern Ireland',
  'GB-SCT': 'Scotland',
  'GB-WLS': 'Wales',
};

@Component({
  selector: 'app-leave-planner',
  imports: [FormsModule, FontAwesomeModule],
  templateUrl: './leave-planner.component.html',
  styleUrl: './leave-planner.component.css',
})
export class LeavePlannerComponent {
  closeIcon = faXmark;

  year: number;
  settings: Settings;
  country: string;
  region: string | null;

  countries: { countryCode: string; name: string }[] = [];
  regions: string[] = [];
  holidays: Holiday[] = [];
  bridges: Bridge[] = [];
  isLoading = true;
  error = '';

  private today = moment().format('YYYY-MM-DD');

  constructor(
    public windowsService: WindowsService,
    private integrations: IntegrationsService,
    private settingsService: SettingsService
  ) {
    const parameters = this.windowsService.getOpenedWindow()?.parameters as LeavePlannerParameters;
    this.year = parameters.date.getFullYear();
    this.settings = this.settingsService.getSettings();
    this.country = homeCountry(this.settings);
    this.region = this.settings.holidayRegion ?? null;
  }

  async ngOnInit() {
    this.integrations
      .fetchCached<{ countryCode: string; name: string }[]>(`${NAGER}/AvailableCountries`, 'nager:countries', MONTH)
      .then((countries) => (this.countries = countries.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => (this.countries = [{ countryCode: this.country, name: this.country }]));
    await this.load();
  }

  async changeCountry(country: string) {
    this.country = country;
    this.region = null;
    this.save();
    await this.load();
  }

  changeRegion(region: string | null) {
    this.region = region || null;
    this.save();
    this.compute(this.lastLoaded);
  }

  isPast(date: string) {
    return date < this.today;
  }

  format(date: string, withWeekday = true) {
    return moment(date).format(withWeekday ? 'ddd D MMM' : 'D MMM');
  }

  /** "Tue 7 – Thu 9 Apr", or a single day */
  leaveRange(bridge: Bridge) {
    const [first, last] = [bridge.leaveDays[0], bridge.leaveDays[bridge.leaveDays.length - 1]];
    return first === last ? this.format(first) : `${this.format(first)} – ${this.format(last)}`;
  }

  regionName(code: string) {
    return REGION_NAMES[code] ?? code;
  }

  holidayNames(bridge: Bridge) {
    return bridge.holidays.map((h) => h.name).join(', ');
  }

  private lastLoaded: NagerHoliday[] = [];

  private async load() {
    this.isLoading = true;
    this.error = '';
    try {
      this.lastLoaded = await this.integrations.fetchCached<NagerHoliday[]>(
        `${NAGER}/PublicHolidays/${this.year}/${this.country}`,
        `nager:${this.year}:${this.country}`,
        MONTH
      );
      this.regions = [...new Set(this.lastLoaded.flatMap((h) => h.counties ?? []))].sort();
      this.compute(this.lastLoaded);
    } catch (message) {
      this.error = `Couldn't load holidays: ${message}`;
      this.holidays = [];
      this.bridges = [];
    } finally {
      this.isLoading = false;
    }
  }

  private compute(all: NagerHoliday[]) {
    this.holidays = holidaysFor(all, this.region);
    this.bridges = findBridges(this.year, this.holidays);
  }

  private save() {
    this.settings = this.settingsService.getSettings();
    this.settings.holidayCountry = this.country;
    this.settings.holidayRegion = this.region;
    this.settingsService.setSettings(this.settings);
  }
}
