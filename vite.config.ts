// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BUILD_ID = String(Date.now());

function emitVersionJson(): Plugin {
  return {
    name: "emit-version-json",
    apply: "build",
    buildStart() {
      try {
        writeFileSync(
          resolve(process.cwd(), "public/version.json"),
          JSON.stringify({ version: BUILD_ID }) + "\n",
        );
      } catch {
        // best-effort; harmless if it fails
      }
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [emitVersionJson()],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(BUILD_ID),
    },
  },
});
