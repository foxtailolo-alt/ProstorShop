export const TELEGRAM_POST_EMOJI = {
  money: "💸",
  address: "📍",
  hours: "⏱",
  contact: "✈️",
} as const;

const STORE_ADDRESS_LINE = `${TELEGRAM_POST_EMOJI.address} Адрес: ул. Горького 153, магазин Простор`;
const STORE_HOURS_LINE = `${TELEGRAM_POST_EMOJI.hours} График работы: 10:00 - 20:00 без выходных`;
const STORE_CONTACT_LINE = `${TELEGRAM_POST_EMOJI.contact} Купить / забронировать: @PROSTOR_NN | +79334144337`;

function normalizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function hasStoreFooter(value: string) {
  return value.includes("ул. Горького 153, магазин Простор") || value.includes("Купить / забронировать: @PROSTOR_NN | +79334144337");
}

export function buildTelegramPriceLine(priceText: string) {
  return `${TELEGRAM_POST_EMOJI.money} Цена: ${priceText}`;
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
    return normalizedDescription;
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
