import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ["../.."] }, // shared package and design tokens live at the repo root
    proxy: { "/api": "http://localhost:4000" },
  },
});
