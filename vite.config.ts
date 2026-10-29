import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "/przeplyw/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        id: "/przeplyw/",
        name: "PRZEPŁYW",
        short_name: "PRZEPŁYW",
        description: "Mobilne laboratorium sieci: przewidź, sprawdź i zrozum.",
        lang: "pl",
        start_url: "/przeplyw/",
        scope: "/przeplyw/",
        display: "standalone",
        theme_color: "#172d3b",
        background_color: "#f3f5f4",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html}"],
        navigateFallback: "/przeplyw/index.html",
        navigateFallbackAllowlist: [/^\/przeplyw\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
