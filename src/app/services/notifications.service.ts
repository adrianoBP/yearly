import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import moment from 'moment';
import { ALERT_DAYS, EventFindings, buildAlerts, reminderAlerts } from '../features/alerts';
import { leaveBy } from '../features/crowd';
import { bufferVerdict, neighbours } from '../features/travel';
import { weatherWarnings } from '../features/weather';
import { Event } from '../interfaces/event.interface';
import { FeaturesService } from './features.service';
import { LiveService } from './live.service';
import { SettingsService } from './settings.service';
import { UtilService } from './util.service';
import { WeatherService } from './weather.service';

/** This device's registration with the Yearly server; its presence means notifications are on */
export const PUSH_DEVICE_KEY = 'pushDevice';
/** The last list sent, so an unchanged one isn't sent again */
const PUSH_SENT_KEY = 'pushSent';
/** Events looked at per update, soonest first */
const MAX_EVENTS = 15;
const DAY = 24 * 3600_000;
/** The server refuses longer lists */
const MAX_ALERTS = 50;

interface Device {
  id: string;
  token: string;
  /** The server key it subscribed with; a new one (server reinstalled) means subscribing again */
  publicKey: string;
}

export type PushState = 'no-server' | 'unsupported' | 'blocked' | 'off' | 'on';

const randomId = () => crypto.randomUUID().replace(/-/g, '');
const isTimed = (e: Event) => !(e.startMoment.format('HH:mm') === '00:00' && e.endMoment.format('HH:mm') === '00:00');

/** Notifications through the Yearly server: this device's switch, and the alerts it sends there */
@Injectable()
export class NotificationsService {
  constructor(
    private swPush: SwPush,
    private util: UtilService,
    private live: LiveService,
    private places: WeatherService,
    private settingsService: SettingsService,
    private features: FeaturesService
  ) {}

  get state(): PushState {
    if (!this.util.serverUrl) return 'no-server';
    if (!this.swPush.isEnabled || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    return this.device ? 'on' : 'off';
  }

  /** Asks the browser's permission and registers this device */
  async enable(): Promise<void> {
    const publicKey = await this.publicKey();
    const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
    const device: Device = { id: randomId(), token: randomId() + randomId(), publicKey };
    await this.put(device, subscription, []);
    this.saveDevice(device);
  }

  async disable(): Promise<void> {
    const device = this.device;
    localStorage.removeItem(PUSH_DEVICE_KEY);
    localStorage.removeItem(PUSH_SENT_KEY);
    if (device) await this.call(device, 'DELETE').catch(() => {});
    await this.swPush.unsubscribe().catch(() => {});
  }

  async test(): Promise<void> {
    const response = await this.call(this.device!, 'POST', '/test');
    if (!response.ok) throw "The notification couldn't be sent. Try turning notifications off and on again.";
  }

  /** Works out this device's alerts for the next few days and hands them to the server */
  async update(events: Event[]): Promise<void> {
    const device = this.device;
    if (!device || this.state !== 'on') return;
    try {
      let subscription = await firstValueFrom(this.swPush.subscription);
      const publicKey = await this.publicKey();
      if (!subscription || publicKey !== device.publicKey) {
        // The browser dropped the subscription or the server has new keys: subscribe again (permission is already given)
        await this.swPush.unsubscribe().catch(() => {});
        subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
        device.publicKey = publicKey;
        this.saveDevice(device);
      }

      const muted = new Set(this.settingsService.getSettings().calendars.filter((c) => c.notify === false).map((c) => c.id));
      events = events.filter((e) => !muted.has(e.calendarId));
      // Soonest first, so a full list drops the furthest ahead
      const alerts = [...buildAlerts(await this.findings(events)), ...reminderAlerts(events)]
        .sort((a, b) => a.at - b.at)
        .slice(0, MAX_ALERTS);
      const hash = JSON.stringify([subscription.endpoint, alerts]);
      const sent = JSON.parse(localStorage.getItem(PUSH_SENT_KEY) ?? 'null');
      // Unchanged lists are still sent once a day, so the server knows the device is in use
      if (sent?.hash === hash && Date.now() - sent.at < DAY) return;

      await this.put(device, subscription, alerts);
      localStorage.setItem(PUSH_SENT_KEY, JSON.stringify({ hash, at: Date.now() }));
    } catch (e) {
      // Offline or the server is down: the next update tries again
      console.warn('Notifications not updated', e);
    }
  }

  /** Crowds, traffic, weather and gaps for the next few days' events; one event at a time, as OpenStreetMap asks */
  private async findings(events: Event[]): Promise<EventFindings[]> {
    const now = moment();
    const until = now.clone().add(ALERT_DAYS, 'days');
    const unique = [...new Map(events.map((e) => [e.id, e])).values()];
    const upcoming = unique
      .filter((e) => e.location?.trim() && e.startMoment.isAfter(now) && e.startMoment.isBefore(until))
      .sort((a, b) => a.startMoment.valueOf() - b.startMoment.valueOf())
      .slice(0, MAX_EVENTS);
    const home = this.settingsService.getSettings().homeAddress;

    const findings: EventFindings[] = [];
    for (const event of upcoming) {
      const location = event.location!;
      const start = event.startMoment.toDate();
      const found: EventFindings = { id: event.id, title: event.title, start };
      try {
        if (this.features.isOn('weather')) {
          const place = await this.places.geocode(location);
          const day = place && (await this.places.forecast(place, event.startMoment, event.endMoment))?.[0];
          if (day) found.weather = weatherWarnings(day);
        }
        if (isTimed(event) && this.features.isOn('crowd-alerts')) {
          found.crowds = await this.live.nearby(location, event.title ?? '', start);
          if (home && this.features.status('crowd-alerts') === 'ready') {
            const route = await this.live.route(home, location, event.startMoment.clone().subtract(1, 'hour').toDate());
            if (route && route.minutes > 0)
              found.home = { ...route, leaveBy: leaveBy(start, route.minutes, found.crowds.length > 0) };
          }
        }
        if (isTimed(event) && this.features.isOn('travel-buffers')) {
          const { after } = neighbours(event, unique);
          const route = after && (await this.live.route(location, after.location!, event.endMoment.toDate()));
          if (after && route) {
            const gap = after.startMoment.diff(event.endMoment, 'minutes');
            found.next = { title: after.title || '(No title)', minutes: route.minutes, gap, verdict: bufferVerdict(gap, route.minutes) };
          }
        }
      } catch {
        // Whatever couldn't be looked up isn't warned about
      }
      findings.push(found);
    }
    return findings;
  }

  private get device(): Device | null {
    try {
      return JSON.parse(localStorage.getItem(PUSH_DEVICE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  private saveDevice(device: Device) {
    localStorage.setItem(PUSH_DEVICE_KEY, JSON.stringify(device));
  }

  private async publicKey(): Promise<string> {
    const response = await fetch(`${this.util.serverUrl}/push/key`);
    if (!response.ok) throw "The Yearly server didn't answer.";
    return (await response.json()).publicKey;
  }

  private async put(device: Device, subscription: PushSubscription, alerts: unknown[]) {
    const response = await this.call(device, 'PUT', '', { subscription: subscription.toJSON(), alerts });
    if (!response.ok) throw `The Yearly server refused this device (${response.status}).`;
  }

  private call(device: Device, method: string, suffix = '', body?: unknown) {
    return fetch(`${this.util.serverUrl}/push/devices/${device.id}${suffix}`, {
      method,
      headers: { Authorization: `Bearer ${device.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  }
}
