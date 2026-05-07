type CustomerAttributionValue = {
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  landingPath?: string;
  yclid?: string;
};

type CustomerOrderLike = {
  attribution: unknown;
};

export function formatCustomerName(input: {
  firstName?: string | null;
  lastName?: string | null;
  telegramUsername?: string | null;
  phone?: string | null;
}) {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  if (input.telegramUsername) {
    return `@${input.telegramUsername}`;
  }

  if (input.phone) {
    return input.phone;
  }

  return "Клиент";
}

export function parseCustomerAttribution(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as CustomerAttributionValue;
}

function isMiniAppToken(value?: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return normalized.includes("telegram")
    || normalized.includes("mini-app")
    || normalized.includes("miniapp")
    || normalized === "tg"
    || normalized.startsWith("tg_")
    || normalized.includes("/mini-app");
}

function isSiteToken(value?: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return normalized.includes("site") || normalized.includes("web") || normalized.includes("/catalog") || normalized.includes("/");
}

export function inferCustomerSource(input: {
  telegramId?: string | null;
  orders: CustomerOrderLike[];
}) {
  for (const order of input.orders) {
    const attribution = parseCustomerAttribution(order.attribution);

    if (!attribution) {
      continue;
    }

    if (
      isMiniAppToken(attribution.source)
      || isMiniAppToken(attribution.utmSource)
      || isMiniAppToken(attribution.landingPath)
    ) {
      return { code: "mini-app", label: "Мини-приложение" } as const;
    }

    if (
      isSiteToken(attribution.source)
      || isSiteToken(attribution.utmSource)
      || (attribution.landingPath && !isMiniAppToken(attribution.landingPath))
    ) {
      return { code: "site", label: "Сайт" } as const;
    }
  }

  if (input.telegramId) {
    return { code: "mini-app", label: "Мини-приложение" } as const;
  }

  return { code: "site", label: "Сайт" } as const;
}

export function getCustomerTelegramUrl(username?: string | null) {
  const normalized = username?.trim().replace(/^@/, "");
  return normalized ? `https://t.me/${normalized}` : null;
}