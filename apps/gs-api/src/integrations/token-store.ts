import type { Env } from '../types';
import { decryptSecret, encryptSecret, getMasterKey } from '../lib/encryption';
import type { ConnectorId, StoredToken } from './types';

export class OAuthTokenStore {
  constructor(private readonly env: Env) {}
  async put(id: ConnectorId, subject: string, token: StoredToken): Promise<void> {
    const key = await getMasterKey(this.env);
    const encrypted = await encryptSecret(JSON.stringify(token), key);
    await this.env.KV.put(`connector:token:${id}:${subject}`, encrypted);
  }
  async get(id: ConnectorId, subject: string): Promise<StoredToken | null> {
    const encrypted = await this.env.KV.get(`connector:token:${id}:${subject}`);
    if (!encrypted) return null;
    return JSON.parse(await decryptSecret(encrypted, await getMasterKey(this.env))) as StoredToken;
  }
  async delete(id: ConnectorId, subject: string): Promise<void> { await this.env.KV.delete(`connector:token:${id}:${subject}`); }
}
