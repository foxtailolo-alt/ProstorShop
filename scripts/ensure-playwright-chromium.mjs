import { spawnSync } from "node:child_process";
import { platform } from "node:os";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "0",
  CI: process.env.CI || "1",
};

if (platform() === "linux" && typeof process.getuid === "function" && process.getuid() === 0) {
  run("corepack", ["pnpm", "--filter", "@prostor/web", "exec", "playwright", "install-deps", "chromium"], { env });
}

run("corepack", ["pnpm", "--filter", "@prostor/web", "exec", "playwright", "install", "chromium"], { env });