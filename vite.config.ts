import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  const base = "/omega-void/";

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "robots.txt"],
        manifest: {
          name: "Omega Void",
          short_name: "Omega Void",
          description: "Omega Void",
          theme_color: "#ffffff",
          icons: [
            {
              purpose: "maskable",
              sizes: "1024x1024",
              src: "icons/maskable_icon.png",
              type: "image/png",
            },
            {
              purpose: "maskable",
              sizes: "192x192",
              src: "icons/maskable_icon_x192.png",
              type: "image/png",
            },
            {
              purpose: "maskable",
              sizes: "512x512",
              src: "icons/maskable_icon_x512.png",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    base: base, // Set the base path for deployment
    build: {
      outDir: "dist", // Ensure the output directory is 'dist' (matches workflow)
    },
  };
});
