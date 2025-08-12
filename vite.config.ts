import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [".csb.app", "localhost", "127.0.0.1"],
  },
  preview: {
    host: true,
    allowedHosts: [".csb.app", "localhost", "127.0.0.1"],
  },
});
