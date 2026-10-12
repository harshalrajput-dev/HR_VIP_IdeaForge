import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client talks to the Express API directly through VITE_API_URL (CORS is
// configured on the backend). The proxy below is a convenience for local
// development if you prefer same-origin requests.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
