import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Load RSA key from file or environment variable
 */
function loadKey(envVar: string, filePath?: string): string | undefined {
  // First try environment variable
  const envValue = process.env[envVar];
  if (envValue) {
    // Handle base64-encoded keys
    if (!envValue.includes('-----BEGIN')) {
      return Buffer.from(envValue, 'base64').toString('utf8');
    }
    return envValue;
  }

  // Try file path
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }

  return undefined;
}

/**
 * Generate development-only RSA key pair
 * WARNING: Not for production use
 */
function generateDevKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

export default registerAs('app', () => {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const isDev = nodeEnv === 'development' || nodeEnv === 'test';

  // JWT RS256 key loading
  let jwtPrivateKey = loadKey(
    'JWT_PRIVATE_KEY',
    process.env['JWT_PRIVATE_KEY_PATH'],
  );
  let jwtPublicKey = loadKey(
    'JWT_PUBLIC_KEY',
    process.env['JWT_PUBLIC_KEY_PATH'],
  );

  // Fallback to HS256 secret if RS256 keys not configured
  const jwtSecret = process.env['JWT_SECRET'];

  // In development, generate keys if not provided
  if (isDev && !jwtPrivateKey && !jwtPublicKey && !jwtSecret) {
    console.warn(
      'WARNING: Generating development-only JWT keys. NOT FOR PRODUCTION!',
    );
    const devKeys = generateDevKeyPair();
    jwtPrivateKey = devKeys.privateKey;
    jwtPublicKey = devKeys.publicKey;
  }

  // Determine algorithm based on available keys
  const useRS256 = !!(jwtPrivateKey && jwtPublicKey);

  return {
    nodeEnv,
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    apiPrefix: process.env['API_PREFIX'] ?? 'api/v1',

    // JWT Configuration
    // Per CLAUDE.md Section 6.1: JWT tokens with RS256 signing
    jwt: {
      algorithm: useRS256 ? 'RS256' : 'HS256',
      privateKey: jwtPrivateKey,
      publicKey: jwtPublicKey,
      secret: jwtSecret ?? 'change-me-in-production',
      expiresIn: process.env['JWT_EXPIRES_IN'] ?? '30d',
      refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '90d',
      // Per CLAUDE.md: 30 days for mobile, 30 min for web
      mobileExpiresIn: process.env['JWT_MOBILE_EXPIRES_IN'] ?? '30d',
      webExpiresIn: process.env['JWT_WEB_EXPIRES_IN'] ?? '30m',
    },

    // Rate Limiting
    rateLimit: {
      ttl: parseInt(process.env['RATE_LIMIT_TTL'] ?? '60', 10),
      limit: parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10),
    },

    // CORS
    cors: {
      origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3000'],
      credentials: true,
    },

    // Encryption
    encryption: {
      key: process.env['ENCRYPTION_KEY'],
      keyVersion: parseInt(process.env['ENCRYPTION_KEY_VERSION'] ?? '1', 10),
    },

    // Object Storage Configuration
    // Per GAP-004: Supports AWS S3, GCP, Azure, and local file storage
    storage: {
      // Active provider: 'aws' | 'gcp' | 'azure' | 'local'
      provider: process.env['STORAGE_PROVIDER'] ?? 'local',

      // Bucket/container names for different document types
      buckets: {
        kyc: process.env['STORAGE_BUCKET_KYC'] ?? 'kyc-documents',
        policies: process.env['STORAGE_BUCKET_POLICIES'] ?? 'policy-documents',
        claims: process.env['STORAGE_BUCKET_CLAIMS'] ?? 'claim-documents',
      },

      // AWS S3 Configuration
      aws: {
        region: process.env['AWS_REGION'] ?? 'eu-west-1',
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
        endpoint: process.env['AWS_S3_ENDPOINT'], // For MinIO/LocalStack
        publicEndpoint: process.env['AWS_S3_PUBLIC_ENDPOINT'], // Public URL for presigned URLs (browser-accessible)
        forcePathStyle: process.env['AWS_S3_FORCE_PATH_STYLE'] === 'true',
      },

      // GCP Cloud Storage Configuration
      gcp: {
        projectId: process.env['GCP_PROJECT_ID'],
        keyFilePath: process.env['GCP_KEY_FILE_PATH'],
        credentials: process.env['GCP_CREDENTIALS'], // JSON string
      },

      // Azure Blob Storage Configuration
      azure: {
        connectionString: process.env['AZURE_STORAGE_CONNECTION_STRING'],
        accountName: process.env['AZURE_STORAGE_ACCOUNT_NAME'],
        accountKey: process.env['AZURE_STORAGE_ACCOUNT_KEY'],
      },

      // Local File Storage Configuration
      local: {
        basePath: process.env['STORAGE_LOCAL_PATH'] ?? './docstore',
      },
    },
  };
});
