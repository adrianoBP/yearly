import { ProviderId } from './integrations';

export interface StoredKey {
  /** Empty when the key was removed, so the removal syncs too */
  value: string;
  /** When it last changed (ms); the newest change wins */
  at: number;
}

export interface UsageEntry {
  period: string;
  count: number;
  limitReached?: boolean;
}

export type KeyMap = Partial<Record<ProviderId, StoredKey>>;
export type UsageMap = Partial<Record<ProviderId, UsageEntry>>;

/** The file kept in the user's Google Drive app folder */
export interface SyncFile {
  keys: KeyMap;
  /** Device id → that device's usage; each device only ever writes its own entry */
  usage: Record<string, UsageMap>;
}

/** Newest key per provider wins; this device's usage replaces its old copy, other devices' usage is kept */
export function mergeSync(local: SyncFile, remote: SyncFile | null, deviceId: string): SyncFile {
  const keys: KeyMap = { ...remote?.keys };
  for (const [id, key] of Object.entries(local.keys) as [ProviderId, StoredKey][]) {
    const other = keys[id];
    if (other == null || key.at >= other.at) keys[id] = key;
  }
  return {
    keys,
    usage: { ...remote?.usage, [deviceId]: local.usage[deviceId] ?? {} },
  };
}
