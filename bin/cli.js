#!/usr/bin/env node

// This wrapper re-spawns itself with tsx loaded via --import
// so that .ts imports work correctly on all platforms.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const entry = join(__dirname, "_cli.ts");

try {
  execFileSync(process.execPath, ["--import", "tsx/esm", entry, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} catch (e) {
  process.exit(e.status || 1);
}
