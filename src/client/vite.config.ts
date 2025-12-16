import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Allow access from Docker container network
    host: '0.0.0.0',
    // Enable HMR for Docker
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        // Use 'server' hostname when running in Docker, 'localhost' otherwise
        target: process.env.DOCKER_ENV === 'true' ? 'http://server:3000' : 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
