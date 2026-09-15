import { defineConfig, loadEnv } from "vite";
import viteReact from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env so the dev proxy always targets the SAME port the Express server
  // runs on (server uses process.env.PORT, default 5001). Single source of truth
  // avoids the proxy/server port drift that silently breaks all /api calls.
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "5001";

  return {
    plugins: [TanStackRouterVite(), viteReact(), tailwindcss(), tsconfigPaths()],
    server: {
      port: 5173,
      // Proxy API requests to the Express server on its configured port
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
            }
            if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query")) {
              return "router-vendor";
            }
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }
            if (id.includes("recharts")) {
              return "charts-vendor";
            }
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
