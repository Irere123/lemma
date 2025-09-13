import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      customViteReactPlugin: true,
      target: "cloudflare-module", // Key configuration for Cloudflare compatibility
    }),
    tailwindcss(),
    viteReact(),
    tsconfigPaths(),
  ],
});
