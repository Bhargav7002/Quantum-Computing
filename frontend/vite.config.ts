import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend CORS allow-list only contains http://localhost:5173 and
// http://127.0.0.1:5173 (see docs/api-contract.md §10), so the dev server
// must stay on port 5173. strictPort makes Vite fail loudly instead of
// silently moving to 5174, which the backend would reject.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
