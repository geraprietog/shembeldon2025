import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // ✅ acepta cualquier host (evita el “Blocked request” en csb.app)
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
});
