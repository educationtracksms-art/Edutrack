// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      // Keep first-paint JS small; heavy vendors become separate cacheable chunks.
      chunkSizeWarningLimit: 900,
      cssCodeSplit: true,
      // Faster rebuilds with persistent caching
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Return string name for chunk, or undefined to use default chunking
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
              if (id.includes("@tanstack")) return "vendor-router";
              if (id.includes("lucide-react") || id.includes("sonner")) return "vendor-ui";
              if (id.includes("recharts")) return "vendor-charts";
              if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) return "vendor-forms";
            }
            return undefined;
          },
        },
        // Enable tree shaking for better dead code elimination
        treeshake: {
          moduleSideEffects: (id) => {
            // Keep side effects for modules that may have important initialization
            if (id.includes("lucide-react")) return false;
            return true;
          },
        },
      },
    },
    server: {
      // Enable HTTP/2 for faster local dev
      hmr: {
        // Faster HMR updates
        overlay: false,
      },
    },
    // Optimize build for smaller initial payload
    optimizeDeps: {
      // Pre-bundle deps for faster dev startup
      include: ["lucide-react", "recharts"],
    },
  },
});
