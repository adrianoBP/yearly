import { Injectable, Injector } from '@angular/core';
import { debounceTime } from 'rxjs';
import { GoogleAuthService } from './google/auth.service';
import { IntegrationsService } from './integrations.service';
import { SyncFile, mergeSync } from './sync';
import { UtilService } from './util.service';

const FILE_NAME = 'yearly-sync.json';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

/** Keeps API keys and usage in the hidden app folder of the user's own Google Drive */
@Injectable()
export class SyncService {
  constructor(
    private injector: Injector,
    private integrations: IntegrationsService,
    private utilService: UtilService
  ) {}

  status: SyncStatus = 'off';
  private started = false;
  private fileId: string | null = null;
  /** Syncs run one after another so two never write the file at once */
  private queue = Promise.resolve();

  /** Pulls once and then pushes after every change; safe to call more than once */
  start() {
    if (this.started || this.utilService.mockData) return;
    this.started = true;
    this.integrations.changed.pipe(debounceTime(3000)).subscribe(() => this.sync());
    this.sync();
  }

  sync(): Promise<void> {
    this.queue = this.queue.then(() => this.run());
    return this.queue;
  }

  private async run() {
    const auth = this.injector.get(GoogleAuthService);
    this.status = 'syncing';
    try {
      this.fileId ??= await this.findFile(auth);
      const remote = this.fileId ? await auth.makeRequest<SyncFile>(`${DRIVE}/${this.fileId}?alt=media`, 'get', null, false) : null;
      const merged = mergeSync(this.integrations.syncData(), remote, this.integrations.deviceId);
      this.integrations.applySync(merged);

      if (this.fileId == null) {
        const created = await auth.makeRequest<{ id: string }>(DRIVE, 'post', { name: FILE_NAME, parents: ['appDataFolder'] }, false);
        this.fileId = created.id;
      }
      await auth.makeRequest(`${UPLOAD}/${this.fileId}?uploadType=media`, 'patch', merged, false);
      this.status = 'synced';
    } catch (e) {
      // Usually a sign-in from before Drive access was asked for; keys keep working on this device
      console.warn('Sync failed', e);
      this.status = 'error';
    }
  }

  private async findFile(auth: GoogleAuthService): Promise<string | null> {
    const query = encodeURIComponent(`name='${FILE_NAME}'`);
    const result = await auth.makeRequest<{ files: { id: string }[] }>(
      `${DRIVE}?spaces=appDataFolder&q=${query}&fields=files(id)`,
      'get',
      null,
      false
    );
    return result.files[0]?.id ?? null;
  }
}
