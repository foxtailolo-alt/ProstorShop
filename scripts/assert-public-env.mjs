import fs from "node:fs";

function fail(message) {
  console.error(`\n[prostor] ${message}\n`);
  process.exit(1);
}

function parseUrl(rawValue, variableName) {
  if (!rawValue) {
    fail(`${variableName} must be set for a production build.`);
  }

  try {
    return new URL(rawValue);
  } catch {
    fail(`${variableName} must be a valid absolute URL. Received: ${rawValue}`);
  }
}

function isLocalHostname(hostname) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "0.0.0.0";
}

const envLocalPath = ".env.local";

if (fs.existsSync(envLocalPath)) {
  fail("apps/web/.env.local must not exist on the production host. Use the root .env file for deploy-time variables.");
}

const siteUrl = parseUrl(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL");

if (siteUrl.protocol !== "https:") {
  fail("NEXT_PUBLIC_SITE_URL must use https in production.");
}

if (isLocalHostname(siteUrl.hostname)) {
  fail("NEXT_PUBLIC_SITE_URL must not point to localhost in production.");
}

const miniAppUrlValue = process.env.TELEGRAM_MINI_APP_URL?.trim();

if (miniAppUrlValue) {
  const miniAppUrl = parseUrl(miniAppUrlValue, "TELEGRAM_MINI_APP_URL");

  if (miniAppUrl.protocol !== "https:") {
    fail("TELEGRAM_MINI_APP_URL must use https in production.");
  }

  if (isLocalHostname(miniAppUrl.hostname)) {
    fail("TELEGRAM_MINI_APP_URL must not point to localhost in production.");
  }

  if (miniAppUrl.origin !== siteUrl.origin) {
    fail("TELEGRAM_MINI_APP_URL must use the same origin as NEXT_PUBLIC_SITE_URL in production.");
  }
}

console.log(`[prostor] Production public env verified for ${siteUrl.origin}`);