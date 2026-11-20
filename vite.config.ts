import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";

const builtAt = new Date().toISOString();
const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const version = `${builtAt.slice(0, 19).replaceAll(":", "").replace("T", "-")}-${revision}`;
const offlineBuild = (): Plugin => ({
  name: "wdw-offline-build",
  generateBundle(_options, bundle) {
    const files = ["./", "index.html", ...Object.keys(bundle).filter((file) => /\.(js|css)$/.test(file))];
    const source = readFileSync(new URL("./tools/service-worker.js", import.meta.url), "utf8")
      .replace("__BUILD__", JSON.stringify(version)).replace("__PRECACHE__", JSON.stringify(files));
    this.emitFile({ type: "asset", fileName: "sw.js", source });
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version, builtAt, revision }) });
  },
});

// GitHub Pages では https://pyonkichi777.github.io/wdw-futari/ で配信される
export default defineConfig({
  base: "/wdw-futari/",
  plugins: [react(), offlineBuild()],
  define: { __APP_VERSION__: JSON.stringify(version) },
});
