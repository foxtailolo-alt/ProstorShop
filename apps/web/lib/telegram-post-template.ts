export const TELEGRAM_POST_EMOJI = {
  money: "💸",
  address: "📍",
  hours: "⏱",
  contact: "✈️",
} as const;

const STORE_ADDRESS_LINE = `${TELEGRAM_POST_EMOJI.address} Адрес: ул. Горького 153, магазин Простор`;
const STORE_HOURS_LINE = `${TELEGRAM_POST_EMOJI.hours} График работы: 10:00 - 20:00 без выходных`;
const STORE_CONTACT_LINE = `${TELEGRAM_POST_EMOJI.contact} Купить / забронировать: @PROSTOR_NN | +79334144337`;
const PRICE_LINE_PREFIX = `${TELEGRAM_POST_EMOJI.money} Цена:`;

function normalizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function restoreSupportedTelegramTags(value: string) {
  return value
    .replace(/&lt;(\/?(?:b|strong|i|em|u|s|del|code|pre|blockquote|tg-spoiler))&gt;/g, "<$1>")
    .replace(/&lt;br\s*\/??&gt;/g, "<br />");
}

function hasStoreFooter(value: string) {
  return value.includes("ул. Горького 153, магазин Простор") || value.includes("Купить / забронировать: @PROSTOR_NN | +79334144337");
}

export function buildTelegramPriceLine(priceText: string) {
  return `${PRICE_LINE_PREFIX} ${priceText}`;
}

function replaceTelegramStoreFooterPrice(description: string, priceText: string) {
  const lines = normalizeMultilineText(description).split("\n");
  const nextPriceLine = buildTelegramPriceLine(priceText);
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (line.trim().startsWith(PRICE_LINE_PREFIX)) {
      replaced = true;
      return nextPriceLine;
    }

    return line;
  });

  return replaced ? nextLines.join("\n") : `${normalizeMultilineText(description)}\n\n${nextPriceLine}`;
}

export function buildTelegramStoreFooter(priceText: string) {
  return [
    buildTelegramPriceLine(priceText),
    STORE_ADDRESS_LINE,
    STORE_HOURS_LINE,
    STORE_CONTACT_LINE,
  ].join("\n\n");
}

export function appendTelegramStoreFooter(description: string, priceText: string) {
  const normalizedDescription = normalizeMultilineText(description);

  if (!normalizedDescription) {
    return buildTelegramStoreFooter(priceText);
  }

  if (hasStoreFooter(normalizedDescription)) {
    return replaceTelegramStoreFooterPrice(normalizedDescription, priceText);
  }

  return `${normalizedDescription}\n\n${buildTelegramStoreFooter(priceText)}`;
}

export function buildTelegramPostText(input: { title: string; description: string; priceText: string }) {
  const normalizedTitle = input.title.trim();
  const normalizedDescription = normalizeMultilineText(input.description);
  const body = hasStoreFooter(normalizedDescription)
    ? normalizedDescription
    : [normalizedDescription, buildTelegramPriceLine(input.priceText)].filter(Boolean).join("\n\n");

  return [normalizedTitle, body].filter(Boolean).join("\n\n");
}

export function buildTelegramPostPreviewHtml(input: { title: string; description: string; priceText: string }) {
  return restoreSupportedTelegramTags(escapeHtml(buildTelegramPostText(input))).replace(/\n/g, "<br />");
}
