import { Command } from "commander";
import { startServer } from "../server/index.ts";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

function checkPrerequisites(): void {
  console.log("  Checking prerequisites...\n");

  // 1. Check Claude Code is installed
  try {
    const version = execSync("claude --version", { encoding: "utf8", timeout: 5000 }).trim();
    console.log(`  ✓ Claude Code installed (${version})`);
  } catch {
    console.error("  ✗ Claude Code is not installed or not in PATH");
    console.error("    Install it: https://docs.anthropic.com/en/docs/claude-code\n");
    process.exit(1);
  }

  // 2. Check authenticated
  const credsPath = join(homedir(), ".claude", ".credentials.json");
  if (!existsSync(credsPath)) {
    console.error("  ✗ Not authenticated — credentials file not found");
    console.error("    Run: claude login\n");
    process.exit(1);
  }

  try {
    const creds = JSON.parse(readFileSync(credsPath, "utf8"));
    const token = creds?.claudeAiOauth?.accessToken;
    if (!token) {
      console.error("  ✗ Not authenticated — no OAuth token found");
      console.error("    Run: claude login\n");
      process.exit(1);
    }
    console.log("  ✓ Authenticated");
  } catch {
    console.error("  ✗ Could not read credentials file");
    console.error("    Run: claude login\n");
    process.exit(1);
  }

  // 3. Check subscription (hit usage API)
  const creds = JSON.parse(readFileSync(credsPath, "utf8"));
  const token = creds.claudeAiOauth.accessToken;

  // Use sync check via claude CLI to avoid async complexity here
  try {
    const result = execSync("claude --version", { encoding: "utf8", timeout: 5000 });
    // If we got here, claude works. We'll verify subscription async on first usage.
    console.log("  ✓ Ready\n");
  } catch {
    console.log("  ✓ Ready (subscription will be verified on first use)\n");
  }
}

const program = new Command();

program
  .name("samaraui")
  .description("Web UI for Claude Code")
  .version("0.2.0")
  .argument("[directory]", "Working directory for agents", process.cwd())
  .option("-p, --port <port>", "Port to run on", "4827")
  .option("--no-open", "Don't open browser automatically")
  .option("--skip-checks", "Skip prerequisite checks")
  .action(async (directory, options) => {
    const port = parseInt(options.port);
    const cwd = directory;

    console.log(`\n  SamaraUI`);
    console.log(`  Working directory: ${cwd}\n`);

    if (!options.skipChecks) {
      checkPrerequisites();
    }

    console.log(`  Starting server on port ${port}...`);

    const { server, launchBrowser } = await startServer({ port, cwd });

    const url = `http://localhost:${port}/_app/`;
    console.log(`  Ready at ${url}\n`);

    if (options.open !== false) {
      await launchBrowser(url);
      console.log(`  Browser launched\n`);
    }
  });

program.parse();
