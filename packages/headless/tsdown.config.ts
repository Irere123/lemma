import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  banner: {
    js: "'use client'",
  },
  minify: true,
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
})
