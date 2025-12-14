/**
 * Environment configuration
 * Validates and exports environment variables
 */

interface EnvConfig {
  apiUrl: string;
  appName: string;
  sessionTimeout: number;
  enableMockData: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = import.meta.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarAsNumber(key: string, defaultValue: number): number {
  const value = import.meta.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvVarAsBoolean(key: string, defaultValue: boolean): boolean {
  const value = import.meta.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

export const env: EnvConfig = {
  apiUrl: getEnvVar('VITE_API_URL', 'http://localhost:3000/api/v1'),
  appName: getEnvVar('VITE_APP_NAME', 'BodaInsure Admin'),
  sessionTimeout: getEnvVarAsNumber('VITE_SESSION_TIMEOUT', 30),
  enableMockData: getEnvVarAsBoolean('VITE_ENABLE_MOCK_DATA', false),
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
