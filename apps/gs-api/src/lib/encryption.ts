/**
 * Encryption utilities for secure credential storage
 * Uses Web Crypto API (SubtleCrypto) with AES-256-GCM
 * Master key sourced from a Cloudflare Secrets Store secret binding
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 128; // 128 bits

/**
 * Retrieve and import the master encryption key from a Secrets Store binding.
 */
export async function getMasterKey(env: any): Promise<CryptoKey> {
  const masterKeySecret = env.INTEGRATION_MASTER_KEY;
  if (!masterKeySecret) {
    throw new Error('INTEGRATION_MASTER_KEY secret binding is not configured');
  }

  try {
    if (typeof masterKeySecret !== 'string') {
      throw new Error('INTEGRATION_MASTER_KEY must be a text secret binding');
    }

    // The deployed Secrets Store entry is generated with `openssl rand -hex 32`.
    // That produces 64 hex characters representing the 32 raw bytes AES-256
    // requires; importing the UTF-8 text directly would instead provide 64 bytes
    // and Web Crypto rejects it. Retain support for an explicitly supplied 32-byte
    // text key so existing non-hex development fixtures remain valid.
    const normalizedSecret = masterKeySecret.trim();
    const keyData = /^[0-9a-f]{64}$/i.test(normalizedSecret)
      ? Uint8Array.from(normalizedSecret.match(/.{2}/g)!, (pair) => Number.parseInt(pair, 16))
      : new TextEncoder().encode(masterKeySecret);

    if (keyData.byteLength !== KEY_LENGTH / 8) {
      throw new Error('INTEGRATION_MASTER_KEY must encode exactly 32 bytes');
    }

    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Failed to retrieve master key:', error);
    throw new Error('Failed to load encryption master key');
  }
}

/**
 * Encrypt a secret value using AES-256-GCM
 * Returns base64-encoded combination of IV + ciphertext with auth tag
 */
export async function encryptSecret(
  plaintext: string,
  masterKey: CryptoKey
): Promise<string> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      masterKey,
      encoded
    );

    // Combine IV and ciphertext (auth tag is included in ciphertext by GCM mode)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Return as base64 for JSON storage
    return btoa(String.fromCharCode(...Array.from(combined)));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt secret');
  }
}

/**
 * Decrypt a secret value encrypted with encryptSecret()
 * Extracts IV from beginning of encrypted value
 */
export async function decryptSecret(
  encrypted: string,
  masterKey: CryptoKey
): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    if (combined.length < IV_LENGTH) {
      throw new Error('Invalid encrypted value: too short');
    }

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      masterKey,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt secret');
  }
}

/**
 * Generate a searchable hash for a key value
 * Used in audit logs and verification without exposing the actual key
 * Hash combines key_prefix + full_key to ensure uniqueness
 */
export async function hashKeyForSearch(
  keyPrefix: string,
  fullKey: string
): Promise<string> {
  try {
    const combined = keyPrefix + fullKey;
    const buffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(combined)
    );
    return btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer))));
  } catch (error) {
    console.error('Hash generation failed:', error);
    throw new Error('Failed to generate key hash');
  }
}

/**
 * Extract key prefix (first N characters) for display in admin UI
 * Shows just enough to identify the key without revealing the full value
 */
export function getKeyPrefix(fullKey: string, prefixLength: number = 8): string {
  if (!fullKey || fullKey.length < prefixLength) {
    return fullKey;
  }
  return fullKey.substring(0, prefixLength) + '_*****';
}

/**
 * Validate that a decrypted key matches expected format
 * Useful for catch decryption errors or corrupted values
 */
export function validateDecryptedKey(key: string, expectedPrefix?: string): boolean {
  if (!key || typeof key !== 'string' || key.length === 0) {
    return false;
  }
  if (expectedPrefix && !key.startsWith(expectedPrefix)) {
    return false;
  }
  return true;
}
