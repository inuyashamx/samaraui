#!/usr/bin/env node

// This wrapper re-spawns node with tsx loaded via --import.
// We resolve tsx/esm relative to THIS package (not the user's cwd)
// so it works when samara-ui is installed globally or via npm link.

import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const entry = join(__dirname, "_cli.ts");

// Resolve tsx/esm from this package's node_modules, not from cwd
// Convert to file:// URL for Windows compatibility with --import
const require = createRequire(import.meta.url);
const tsxEsmPath = pathToFileURL(require.resolve("tsx/esm")).href;

try {
  execFileSync(process.execPath, ["--import", tsxEsmPath, entry, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} catch (e) {
  process.exit(e.status || 1);
}
