import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [TanStackRouterVite(), viteReact(), tailwindcss(), tsconfigPaths()],
  server: {
    port: 5173,
    // Proxy API requests to our new Express server
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('@tanstack/react-router') || id.includes('@tanstack/react-query')) {
            return 'router-vendor';
          }
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          if (id.includes('recharts')) {
            return 'charts-vendor';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
