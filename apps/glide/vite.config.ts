import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Multi-page app: IDE (index.html) and Welcome (welcome.html)
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        welcome: resolve(__dirname, "welcome.html"),
      },
    },
  },

  clearScreen: false,
  server: {
    headers: {
      "Content-Security-Policy":
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: tauri: ipc:; connect-src 'self' blob: data: tauri: ipc: ipc://localhost ws://localhost:*; worker-src 'self' blob:;",
    },

    port: 1421,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1422,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
