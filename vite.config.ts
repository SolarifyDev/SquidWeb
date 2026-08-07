/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import htmlPlugin from "vite-plugin-html-config";
import ImportMetaEnvPlugin from "@import-meta-env/unplugin";

const htmlPluginOpt = {
  headScripts: [
    "globalThis.import_meta_env = JSON.parse('\"import_meta_env_placeholder\"')",
  ],
};

// https://vitejs.dev/config https://vitest.dev/config
export default defineConfig({
  plugins: [
    react(),
    ImportMetaEnvPlugin.vite({
      example: ".env.example",
      env: ".env",
    }),
    tsconfigPaths(),
    htmlPlugin(htmlPluginOpt),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:7078',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ".vitest/setup",
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
});
