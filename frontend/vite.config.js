import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The FastAPI backend serves BOTH its JSON routes (under /api) and — in the
// single-server production build — this app's static files. So the frontend uses
// relative /api URLs in dev AND in production. In dev the Vite server proxies
// /api straight through to FastAPI (no path rewrite, since the backend already
// lives under /api). Set VITE_PROXY_TARGET to point at a different backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
