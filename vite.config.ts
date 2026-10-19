import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached long-term
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI primitives (Radix)
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
          ],
          // i18n
          'vendor-i18n': ['i18next', 'react-i18next'],
          // PDF generation — only needed in Documents page
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // Zustand state
          'vendor-state': ['zustand'],
        },
      },
    },
  },
});
