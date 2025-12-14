import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';

/**
 * Encryption configuration (must match EncryptionService)
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Get or create encryption key
 * Uses same logic as EncryptionService for consistency
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = process.env['ENCRYPTION_KEY'];
  if (!keyBase64) {
    // Development fallback - NOT for production
    return crypto.scryptSync('development-only-key', 'bodainsure-salt', KEY_LENGTH);
  }
  return Buffer.from(keyBase64, 'base64');
}

/**
 * TypeORM Value Transformer for encrypted columns
 * Automatically encrypts on write and decrypts on read
 *
 * Usage:
 * @Column({ transformer: EncryptedColumnTransformer })
 * sensitiveField: string;
 */
export const EncryptedColumnTransformer: ValueTransformer = {
  /**
   * Transform value before writing to database (encrypt)
   */
  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      const key = getEncryptionKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      const data = {
        iv: iv.toString('hex'),
        content: encrypted,
        tag: tag.toString('hex'),
        version: parseInt(process.env['ENCRYPTION_KEY_VERSION'] ?? '1', 10),
      };

      return JSON.stringify(data);
    } catch (error) {
      console.error('Column encryption failed:', error);
      throw new Error('Failed to encrypt column value');
    }
  },

  /**
   * Transform value after reading from database (decrypt)
   */
  from(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Handle legacy unencrypted data
    if (!value.startsWith('{')) {
      return value;
    }

    try {
      const data = JSON.parse(value);

      // Validate structure
      if (!data.iv || !data.content || !data.tag) {
        return value; // Legacy unencrypted data
      }

      const key = getEncryptionKey();
      const iv = Buffer.from(data.iv, 'hex');
      const tag = Buffer.from(data.tag, 'hex');

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(data.content, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Column decryption failed:', error);
      return null;
    }
  },
};

/**
 * Transformer for hashed columns (one-way, for indexing)
 * Use when you need to search by encrypted field
 */
export const HashedColumnTransformer: ValueTransformer = {
  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const key = getEncryptionKey();
    return crypto
      .createHmac('sha256', key)
      .update(value.toLowerCase().trim())
      .digest('hex');
  },

  from(value: string | null | undefined): string | null {
    // Hashes are one-way - return as-is
    return value ?? null;
  },
};
