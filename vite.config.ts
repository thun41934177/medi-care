import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Medicare",
        short_name: "Medicare",
        description: "Companion app for elderly care",
        theme_color: "#1f2050",
        background_color: "#1f2050",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:3001", "/ws": { target: "ws://localhost:3001", ws: true } } },
});
