import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

// A page with just the real editor (same extensions and CSS as the app, no
// backend) for the typing-latency benchmark: `bun run bench:build`, then
// `node e2e/latency.mjs`.
export default defineConfig({
  root: __dirname,
  publicDir: '../public',
  define: {
    'import.meta.env.VITE_PUBLIC_BACKEND_URL': JSON.stringify('http://localhost:4000'),
    'import.meta.env.VITE_PUBLIC_APP_URL': JSON.stringify('http://localhost:5173'),
  },
  plugins: [tailwindcss(), tsConfigPaths({ root: '..' }), viteReact()],
  build: { outDir: '../dist-bench', emptyOutDir: true },
})
