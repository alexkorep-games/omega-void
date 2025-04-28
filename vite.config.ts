import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoName = "omega-void";

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const base = command === "build" ? `/${repoName}/` : "/"; // Use repo name for build, root for dev

  return {
    plugins: [react()],
    base: base, // Set the base path for deployment
    build: {
      outDir: "dist", // Ensure the output directory is 'dist' (matches workflow)
    },
  };
});
