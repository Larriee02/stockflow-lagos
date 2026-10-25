import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Enables access from mobile phones & tablets on the same Wi-Fi/Hotspot
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  build: {
    target: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13'],
  },
});
