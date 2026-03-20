import { Command } from "commander";
import { startServer } from "../server/index.ts";

const program = new Command();

program
  .name("samara-ui")
  .description("Web UI for Claude Code")
  .version("0.1.0")
  .argument("[directory]", "Working directory for agents", process.cwd())
  .option("-p, --port <port>", "Port to run on", "3000")
  .option("--no-open", "Don't open browser automatically")
  .action(async (directory, options) => {
    const port = parseInt(options.port);
    const cwd = directory;

    console.log(`\n  Samara Code UI`);
    console.log(`  Working directory: ${cwd}`);
    console.log(`  Starting server on port ${port}...\n`);

    const { server, launchBrowser } = await startServer({ port, cwd });

    const url = `http://localhost:${port}/_app/`;
    console.log(`  Ready at ${url}\n`);

    if (options.open !== false) {
      await launchBrowser(url);
      console.log(`  Browser launched (Playwright)\n`);
    }
  });

program.parse();
