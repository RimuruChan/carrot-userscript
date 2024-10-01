import * as api from '$';

/**
 * Convenience wrapper around userscript storage API.
 */
export class StorageWrapper {
  storageName: string;

  constructor(storageName: string) {
    this.storageName = storageName;
  }

  async get(key: string, defaultValue: any = undefined) {
    return await api.GM_getValue(`${this.storageName}.${key}`, defaultValue);
  }

  async set(key: string, value: any) {
    return await api.GM_setValue(`${this.storageName}.${key}`, value);
  }
}

export const LOCAL = new StorageWrapper('LOCAL');
export const SYNC = new StorageWrapper('SYNC');
