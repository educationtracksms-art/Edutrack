import { devServerBridgePlugin } from "@lovable.dev/vite-plugin-dev-server-bridge";
import { hmrGatePlugin } from "@lovable.dev/vite-plugin-hmr-gate";
import { devtools } from "@tanstack/devtools-vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const isSandbox =
  process.env.LOVABLE_SANDBOX === "1" || Boolean(process.env.DEV_SERVER__PROJECT_PATH);

export default defineConfig(({ command, mode }) => ({
  plugins: [
    ...(mode === "development"
      ? [
          devtools({
            logging: false,
            eventBusConfig: { enabled: false },
            enhancedLogs: { enabled: false },
            consolePiping: { enabled: false },
            removeDevtoolsOnBuild: false,
            injectSource: { enabled: true },
          }),
        ]
      : []),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
    ...(command === "build"
      ? [
          nitro(
            isSandbox
              ? {
                  preset: "cloudflare-module",
                  output: {
                    dir: "dist",
                    serverDir: "dist/server",
                    publicDir: "dist/client",
                  },
                  cloudflare: { nodeCompat: true, deployConfig: true },
                }
              : { defaultPreset: "cloudflare-module" },
          ),
        ]
      : []),
    react(),
    ...(command === "serve" && isSandbox ? [hmrGatePlugin(), devServerBridgePlugin()] : []),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
    tsconfigPaths: true,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "lucide-react",
      "recharts",
    ],
    ignoreOutdatedRequests: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
            if (id.includes("@tanstack")) return "vendor-router";
            if (id.includes("lucide-react") || id.includes("sonner")) return "vendor-ui";
            if (id.includes("recharts")) return "vendor-charts";
            if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) {
              return "vendor-forms";
            }
          }
          return undefined;
        },
      },
      treeshake: {
        moduleSideEffects: (id) => {
          if (id.includes("lucide-react")) return false;
          return true;
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
    ...(isSandbox
      ? {
          strictPort: true,
          watch: {
            ignored: [
              "**/.workspace/**",
              "**/.agents/**",
              "**/.claude/**",
              "**/.lovable/**",
              "**/.tanstack/tmp/**",
            ],
          },
        }
      : {}),
    hmr: { overlay: false },
  },
}));
