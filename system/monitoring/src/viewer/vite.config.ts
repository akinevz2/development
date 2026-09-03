import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    // dev server only: forward API calls to the collector so the page
    // can use same-origin URLs; in production the collector serves the
    // built viewer itself (no proxy, no separate webserver)
    server: {
        proxy: {
            '/api': 'http://localhost:11367'
        }
    }
});
