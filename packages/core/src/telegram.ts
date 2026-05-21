export function normalizeTelegramMiniAppStartParam(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return trimmedValue.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);
}

const TELEGRAM_LOGIN_START_PREFIX = "login-";

export function buildTelegramLoginStartParam(requestId: string) {
  const normalizedRequestId = normalizeTelegramMiniAppStartParam(requestId);

  if (!normalizedRequestId) {
    throw new Error("Telegram login request id is required.");
  }

  return `${TELEGRAM_LOGIN_START_PREFIX}${normalizedRequestId}`;
}

export function parseTelegramLoginStartParam(value: string | null | undefined) {
  const normalizedValue = normalizeTelegramMiniAppStartParam(value);

  if (!normalizedValue?.startsWith(TELEGRAM_LOGIN_START_PREFIX)) {
    return null;
  }

  return normalizedValue.slice(TELEGRAM_LOGIN_START_PREFIX.length) || null;
}

export function buildTelegramBotStartUrl(input: {
  botUsername: string;
  startParam?: string | null;
}) {
  const botUsername = input.botUsername.replace(/^@/, "").trim();

  if (!botUsername) {
    throw new Error("Telegram bot username is required to build bot start URLs.");
  }

  const startParam = normalizeTelegramMiniAppStartParam(input.startParam);

  if (!startParam) {
    return `https://t.me/${botUsername}`;
  }

  return `https://t.me/${botUsername}?start=${encodeURIComponent(startParam)}`;
}

export function buildTelegramMiniAppLaunchUrl(input: {
  botUsername: string;
  shortName?: string | null;
  startParam?: string | null;
  compact?: boolean;
}) {
  const botUsername = input.botUsername.replace(/^@/, "").trim();

  if (!botUsername) {
    throw new Error("Telegram bot username is required to build Mini App launch URLs.");
  }

  const startParam = normalizeTelegramMiniAppStartParam(input.startParam);
  const modeSuffix = input.compact ? `${startParam ? "&" : "?"}mode=compact` : "";

  if (input.shortName?.trim()) {
    const shortName = input.shortName.trim();
    const query = startParam ? `?startapp=${encodeURIComponent(startParam)}` : "";

    return `https://t.me/${botUsername}/${shortName}${query}${modeSuffix}`;
  }

  if (startParam) {
    return `https://t.me/${botUsername}?startapp=${encodeURIComponent(startParam)}${input.compact ? "&mode=compact" : ""}`;
  }

  return `https://t.me/${botUsername}?startapp${input.compact ? "&mode=compact" : ""}`;
}