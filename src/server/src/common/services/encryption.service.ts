import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Encryption configuration
 */
interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  /** Initialization vector (hex) */
  iv: string;
  /** Encrypted content (hex) */
  content: string;
  /** Authentication tag (hex) - for GCM mode */
  tag: string;
  /** Version for key rotation */
  version: number;
}

/**
 * Encryption Service
 * Provides AES-256-GCM encryption for PII fields
 *
 * Per NFR-SEC-003 and CLAUDE.md Section 6.1:
 * - All PII data must be encrypted at rest
 * - HIGH classification fields (national_id, kra_pin) require field-level encryption
 * - MEDIUM classification fields encrypted at database level
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey: Buffer;
  private readonly keyVersion: number;
  private readonly config: EncryptionConfig;

  constructor(private readonly configService: ConfigService) {
    // AES-256-GCM configuration
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 12, // 96 bits recommended for GCM
      tagLength: 16, // 128 bits
    };

    // Load encryption key from environment
    const keyBase64 = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyBase64) {
      this.logger.warn(
        'ENCRYPTION_KEY not configured - generating temporary key (NOT FOR PRODUCTION)',
      );
      // Generate a deterministic key for development (NOT secure for production)
      this.encryptionKey = crypto.scryptSync(
        'development-only-key',
        'bodainsure-salt',
        this.config.keyLength,
      );
    } else {
      this.encryptionKey = Buffer.from(keyBase64, 'base64');
      if (this.encryptionKey.length !== this.config.keyLength) {
        throw new Error(
          `Invalid ENCRYPTION_KEY length. Expected ${this.config.keyLength} bytes, got ${this.encryptionKey.length}`,
        );
      }
    }

    // Key version for rotation support
    this.keyVersion = this.configService.get<number>('ENCRYPTION_KEY_VERSION', 1);
  }

  /**
   * Encrypt a plaintext string
   * Returns null if input is null/undefined
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined) {
      return null;
    }

    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.config.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(
        this.config.algorithm,
        this.encryptionKey,
        iv,
      ) as crypto.CipherGCM;

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag
      const tag = cipher.getAuthTag();

      // Create encrypted data structure
      const data: EncryptedData = {
        iv: iv.toString('hex'),
        content: encrypted,
        tag: tag.toString('hex'),
        version: this.keyVersion,
      };

      // Return as JSON string (to store in varchar column)
      return JSON.stringify(data);
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   * Returns null if input is null/undefined or not valid encrypted data
   */
  decrypt(encryptedJson: string | null | undefined): string | null {
    if (encryptedJson === null || encryptedJson === undefined) {
      return null;
    }

    // Handle legacy unencrypted data (starts with plaintext)
    if (!encryptedJson.startsWith('{')) {
      this.logger.warn('Encountered unencrypted data - returning as-is');
      return encryptedJson;
    }

    try {
      const data: EncryptedData = JSON.parse(encryptedJson);

      // Validate structure
      if (!data.iv || !data.content || !data.tag) {
        this.logger.warn('Invalid encrypted data structure');
        return encryptedJson; // Return as-is for legacy data
      }

      // Check key version (for future key rotation support)
      if (data.version !== this.keyVersion) {
        this.logger.warn(
          `Key version mismatch: expected ${this.keyVersion}, got ${data.version}`,
        );
        // In production, implement key rotation logic here
      }

      // Convert from hex
      const iv = Buffer.from(data.iv, 'hex');
      const tag = Buffer.from(data.tag, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.config.algorithm,
        this.encryptionKey,
        iv,
      ) as crypto.DecipherGCM;

      // Set auth tag
      decipher.setAuthTag(tag);

      // Decrypt
      let decrypted = decipher.update(data.content, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      // Don't expose decryption errors to callers
      return null;
    }
  }

  /**
   * Check if a value is encrypted
   */
  isEncrypted(value: string | null | undefined): boolean {
    if (!value || !value.startsWith('{')) {
      return false;
    }

    try {
      const data = JSON.parse(value);
      return !!(data.iv && data.content && data.tag && data.version);
    } catch {
      return false;
    }
  }

  /**
   * Hash a value for indexing (one-way)
   * Use for searching encrypted fields
   */
  hash(value: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(value.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Generate a new encryption key (utility for setup)
   */
  static generateKey(): string {
    const key = crypto.randomBytes(32);
    return key.toString('base64');
  }

  /**
   * Mask a sensitive value for logging
   */
  mask(value: string | null | undefined, visibleChars: number = 4): string {
    if (!value) return '***';
    if (value.length <= visibleChars) return '***';
    return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
  }
}
