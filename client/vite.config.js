import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Docker bind mounts don't always deliver file events
    watch: { usePolling: Boolean(process.env.VITE_POLL) },
  },
});
