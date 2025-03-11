/**
 * tsup.config.ts
 *
 * Configurazione di build per il pacchetto client-twitch.
 */
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  format: ["esm"],
  bundle: true,
  external: [
    "dotenv",
    "fs",
    "path",
    "http",
    "https",
    "net",
    "@elizaos/core"
  ]
});
