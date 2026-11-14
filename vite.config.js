import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
let buildInfo = { revision: null, dirty: true };
try {
  const options = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  buildInfo = {
    revision: execFileSync("git", ["rev-parse", "HEAD"], options).trim(),
    dirty: !!execFileSync("git", ["status", "--porcelain"], options).trim(),
  };
} catch {
  /* Source archives without Git still run; no revision is invented. */
}
export default defineConfig({
  define: { __BUILD_INFO__: JSON.stringify(buildInfo) },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/three/")) return "space";
          if (id.includes("/react/") || id.includes("/react-dom/"))
            return "react";
        },
      },
    },
  },
});
