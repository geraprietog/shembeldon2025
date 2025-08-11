import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["d397tt-5173.csb.app"], // 👈 aquí pones el host que aparece en el error
  },
});
