import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const outputFile = "prostor-deploy.tgz";
const excludes = [
  ".git",
  ".turbo",
  "node_modules",
  ".next",
  "apps/web/.next",
  "apps/bot/node_modules",
  "apps/web/node_modules",
  "packages/*/node_modules",
  "coverage",
  outputFile,
  ".env",
  "apps/web/.env.local",
  "infra/ai-proxy/proxy.env",
  "deploy-lightbox-admin-fixes.zip",
];

if (existsSync(outputFile)) {
  rmSync(outputFile);
}

const args = ["-czf", outputFile];

for (const pattern of excludes) {
  args.push("--exclude", pattern);
}

args.push(".");

const result = spawnSync(process.platform === "win32" ? "tar.exe" : "tar", args, {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`[prostor] Created ${outputFile} without local env files or build artifacts.`);