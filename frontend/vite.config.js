import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    historyApiFallback: true,
    // Development-only header to relax CSP so browser wallet extensions that
    // rely on runtime evaluation (e.g. eval) can inject their scripts.
    // NOTE: This weakens CSP and MUST NOT be used in production.
    headers: process.env.NODE_ENV === 'production' ? undefined : {
      'Content-Security-Policy': "script-src 'self' 'unsafe-eval' 'unsafe-inline';"
    },
    // Proxy /api requests to the backend. In Docker this should point to the
    // backend service name (http://backend:4000). When developing on host you
    // can set BACKEND_URL to http://localhost:4000 to proxy to a local server.
      proxy: {
      '/api': {
        // Prefer explicit BACKEND_URL (useful for CI or alternative hosts).
        // Default to localhost:4000 for typical host-based dev where backend is published to the host.
        target: process.env.BACKEND_URL || 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
