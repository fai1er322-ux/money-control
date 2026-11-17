import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any static-hosting subpath (e.g. GitHub Pages).
  base: "./",
  build: { target: "es2022", sourcemap: true },
});
