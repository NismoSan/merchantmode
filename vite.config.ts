import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'core'),
      '@utils': path.resolve(__dirname, 'utils'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
