/**
 * Environment configuration for mobile app
 */

interface EnvConfig {
  apiUrl: string;
  appName: string;
  enableMockData: boolean;
}

export const env: EnvConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'BodaInsure',
  enableMockData: process.env.EXPO_PUBLIC_ENABLE_MOCK_DATA === 'true',
};
