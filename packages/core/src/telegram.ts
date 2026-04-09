export function normalizeTelegramMiniAppStartParam(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return trimmedValue.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);
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