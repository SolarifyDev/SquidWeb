/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { createStyleImportPlugin, AntdResolve } from "vite-plugin-style-import";

// https://vitejs.dev/config https://vitest.dev/config
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    createStyleImportPlugin({ resolves: [AntdResolve()] }),
  ],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ".vitest/setup",
    include: ["**/test.{ts,tsx}"],
  },
});
