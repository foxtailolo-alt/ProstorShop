import type { CatalogProduct } from "@prostor/core";
import {
  buildCurrentDeviceRankLabel,
  extractStorageValue,
  getCategoryCodeFamily,
  getModelRank,
  getProductFamily,
  normalizeText,
  type DeviceFamily,
} from "./upgrade-suggestions";

export type UsedDeviceWaitlistEntryInput = {
  categoryCode: string;
  brand: string;
  model: string;
  deviceModelCode?: string | null;
  normalizedModel?: string | null;
  modelRank?: number | null;
  storage?: string | null;
  color?: string | null;
  displaySize?: string | null;
  connectivity?: string | null;
};

export type UsedDeviceWaitlistMatchBreakdown = {
  family: DeviceFamily;
  model: { matched: boolean; requested: string; actual: string; source: "rank" | "title" };
  storage: { matched: boolean; requested: string | null; actual: string | null; source: "attribute" | "title" | "missing" };
  color: { matched: boolean; requested: string | null; actual: string | null; source: "attribute" | "title" | "missing" | "ignored" };
  displaySize: { matched: boolean; requested: string | null; actual: string | null; source: "attribute" | "title" | "missing" | "ignored" };
  connectivity: { matched: boolean; requested: string | null; actual: string | null; source: "attribute" | "title" | "missing" | "ignored" };
};

export type UsedDeviceWaitlistProductMatch = {
  isMatch: boolean;
  confidence: number;
  matchSource: "attribute" | "title_fallback" | "hybrid" | "none";
  breakdown: UsedDeviceWaitlistMatchBreakdown | null;
};

type ResolvedTrait = {
  value: string | null;
  source: "attribute" | "title" | "missing";
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");
  return normalized || null;
}

function normalizeColor(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized || normalized === "не важно" || normalized === "lyuboy" || normalized === "any") {
    return null;
  }

  return normalized;
}

function getColorTone(value: string | null | undefined) {
  const normalized = normalizeColor(value);
  if (!normalized) {
    return null;
  }

  const darkTokens = [
    "темный",
    "temnyy",
    "dark",
    "black",
    "черн",
    "graphite",
    "midnight",
    "space black",
    "space gray",
    "space grey",
    "gray",
    "grey",
    "сер",
    "titan",
    "титан",
    "natural",
    "blue",
    "син",
    "green",
    "зел",
    "purple",
    "фиолет",
  ];
  const lightTokens = [
    "светлый",
    "svetlyy",
    "light",
    "white",
    "бел",
    "silver",
    "сереб",
    "starlight",
    "gold",
    "pink",
    "rose",
    "роз",
    "beige",
    "беж",
    "cream",
    "крем",
    "yellow",
    "желт",
  ];

  if (normalized === "темный") {
    return "dark" as const;
  }

  if (normalized === "светлый") {
    return "light" as const;
  }

  if (darkTokens.some((token) => normalized.includes(token))) {
    return "dark" as const;
  }

  if (lightTokens.some((token) => normalized.includes(token))) {
    return "light" as const;
  }

  return null;
}

function normalizeDisplaySize(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(11|13|40|41|42|44|45|46|49|24|14|15|16|6 1|6 2|6 7|6 8)/);
  if (match?.[1]) {
    return match[1].replace(/\s+/g, ".");
  }

  const decimalMatch = normalized.match(/(\d(?:[.,]\d)?)/);
  return decimalMatch?.[1]?.replace(",", ".") ?? normalized;
}

function normalizeConnectivity(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized || normalized === "не важно") {
    return null;
  }

  if (normalized.includes("cellular")) {
    return "cellular";
  }

  if (normalized.includes("wifi") || normalized.includes("wi fi")) {
    return "wifi";
  }

  return normalized;
}

function buildRequestedModelLabel(family: DeviceFamily, entry: UsedDeviceWaitlistEntryInput) {
  return buildCurrentDeviceRankLabel(family, { model: entry.model });
}

export function buildUsedDeviceWaitlistModelRank(entry: UsedDeviceWaitlistEntryInput) {
  const family = getCategoryCodeFamily(entry.categoryCode);
  if (!family) {
    return null;
  }

  const rank = getModelRank(family, buildRequestedModelLabel(family, entry));
  return rank > 0 ? rank : null;
}

function resolveProductTrait(product: CatalogProduct, attributeKey: string, fallback: () => string | null): ResolvedTrait {
  const attributeValue = product.attributes?.[attributeKey];
  if (attributeValue) {
    return { value: attributeValue, source: "attribute" };
  }

  const fallbackValue = fallback();
  if (fallbackValue) {
    return { value: fallbackValue, source: "title" };
  }

  return { value: null, source: "missing" };
}

function extractColorFromTitle(product: CatalogProduct) {
  const parts = product.name.split("|").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) ?? null : null;
}

function extractConnectivityFromTitle(product: CatalogProduct) {
  const normalized = normalizeText(product.name);
  if (normalized.includes("cellular")) {
    return "Cellular";
  }
  if (normalized.includes("wifi") || normalized.includes("wi fi")) {
    return "Wi-Fi";
  }

  return null;
}

function extractDisplayFromTitle(product: CatalogProduct) {
  const normalized = normalizeText(product.name);
  const match = normalized.match(/\b(11|13|40|41|42|44|45|46|49|24|14|15|16)\b/);
  if (match?.[1]) {
    return match[1];
  }

  const decimalMatch = normalized.match(/\b(\d(?:[.,]\d)?)\b/);
  return decimalMatch?.[1] ?? null;
}

function resolveProductStorage(product: CatalogProduct) {
  const attributeValue = product.attributes?.storage;
  if (attributeValue) {
    return { value: attributeValue, source: "attribute" as const };
  }

  const storage = extractStorageValue(product.name);
  if (storage > 0) {
    return { value: `${storage} GB`, source: "title" as const };
  }

  return { value: null, source: "missing" as const };
}

function resolveProductTraits(product: CatalogProduct) {
  return {
    storage: resolveProductStorage(product),
    color: resolveProductTrait(product, "color", () => extractColorFromTitle(product)),
    displaySize: resolveProductTrait(product, "display", () => extractDisplayFromTitle(product)),
    connectivity: resolveProductTrait(product, "connectivity", () => extractConnectivityFromTitle(product)),
  };
}

function compareOptionalText(requested: string | null, actual: string | null) {
  if (!requested) {
    return true;
  }
  if (!actual) {
    return false;
  }

  const left = normalizeOptionalText(requested);
  const right = normalizeOptionalText(actual);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function compareColorPreference(requested: string | null, actual: string | null) {
  if (!requested) {
    return true;
  }

  const normalizedRequested = normalizeColor(requested);
  const isGroupedPreference = normalizedRequested === "светлый" || normalizedRequested === "темный";
  const requestedTone = isGroupedPreference ? getColorTone(requested) : null;
  const actualTone = isGroupedPreference ? getColorTone(actual) : null;
  if (requestedTone && actualTone) {
    return requestedTone === actualTone;
  }

  return compareOptionalText(requested, actual);
}

function inferMatchSource(traits: ReturnType<typeof resolveProductTraits>, breakdown: UsedDeviceWaitlistMatchBreakdown) {
  const sources = [
    traits.storage.source,
    breakdown.color.source,
    breakdown.displaySize.source,
    breakdown.connectivity.source,
  ].filter((source) => source === "attribute" || source === "title");

  const hasAttribute = sources.includes("attribute");
  const hasTitle = sources.includes("title");

  if (hasAttribute && hasTitle) {
    return "hybrid" as const;
  }
  if (hasTitle) {
    return "title_fallback" as const;
  }
  if (hasAttribute) {
    return "attribute" as const;
  }

  return breakdown.model.source === "rank" ? "attribute" : "none";
}

export function matchUsedDeviceWaitlistEntryToProduct(
  entry: UsedDeviceWaitlistEntryInput,
  product: CatalogProduct,
): UsedDeviceWaitlistProductMatch {
  if (!product.inStock) {
    return { isMatch: false, confidence: 0, matchSource: "none", breakdown: null };
  }

  const family = getCategoryCodeFamily(entry.categoryCode);
  if (!family || getProductFamily(product) !== family) {
    return { isMatch: false, confidence: 0, matchSource: "none", breakdown: null };
  }

  const requestedRank = entry.modelRank ?? buildUsedDeviceWaitlistModelRank(entry);
  const productRank = getModelRank(family, product.name);
  const requestedModel = normalizeOptionalText(entry.normalizedModel)
    ?? normalizeOptionalText(buildRequestedModelLabel(family, entry))
    ?? normalizeOptionalText(entry.model)
    ?? "";
  const modelMatchedByRank = Boolean(requestedRank && productRank && requestedRank === productRank);
  const modelMatchedByTitle = !requestedRank && Boolean(requestedModel && normalizeText(product.name).includes(requestedModel));
  const modelMatched = modelMatchedByRank || modelMatchedByTitle;

  if (!modelMatched) {
    return { isMatch: false, confidence: 0, matchSource: "none", breakdown: null };
  }

  const traits = resolveProductTraits(product);
  const requestedStorage = extractStorageValue(entry.storage);
  const actualStorage = extractStorageValue(traits.storage.value);
  const storageMatched = requestedStorage > 0 ? actualStorage === requestedStorage : true;

  const requestedColor = normalizeColor(entry.color);
  const actualColor = normalizeColor(traits.color.value);
  const colorMatched = requestedColor ? compareColorPreference(requestedColor, actualColor) : true;

  const requestedDisplay = normalizeDisplaySize(entry.displaySize);
  const actualDisplay = normalizeDisplaySize(traits.displaySize.value);
  const displayMatched = requestedDisplay ? requestedDisplay === actualDisplay : true;

  const requestedConnectivity = normalizeConnectivity(entry.connectivity);
  const actualConnectivity = normalizeConnectivity(traits.connectivity.value ?? product.attributes?.sim ?? null);
  const connectivityMatched = requestedConnectivity ? requestedConnectivity === actualConnectivity : true;

  const breakdown: UsedDeviceWaitlistMatchBreakdown = {
    family,
    model: {
      matched: modelMatched,
      requested: requestedModel,
      actual: product.name,
      source: modelMatchedByRank ? "rank" : "title",
    },
    storage: {
      matched: storageMatched,
      requested: requestedStorage > 0 ? String(requestedStorage) : null,
      actual: actualStorage > 0 ? String(actualStorage) : null,
      source: traits.storage.source,
    },
    color: {
      matched: colorMatched,
      requested: requestedColor,
      actual: actualColor,
      source: requestedColor ? traits.color.source : "ignored",
    },
    displaySize: {
      matched: displayMatched,
      requested: requestedDisplay,
      actual: actualDisplay,
      source: requestedDisplay ? traits.displaySize.source : "ignored",
    },
    connectivity: {
      matched: connectivityMatched,
      requested: requestedConnectivity,
      actual: actualConnectivity,
      source: requestedConnectivity ? traits.connectivity.source : "ignored",
    },
  };

  if (!storageMatched || !colorMatched || !displayMatched || !connectivityMatched) {
    return {
      isMatch: false,
      confidence: 0,
      matchSource: inferMatchSource(traits, breakdown),
      breakdown,
    };
  }

  let confidence = 45;
  if (requestedStorage > 0) {
    confidence += 20;
  }
  if (requestedColor) {
    confidence += 15;
  }
  if (requestedDisplay) {
    confidence += 10;
  }
  if (requestedConnectivity) {
    confidence += 10;
  }

  return {
    isMatch: true,
    confidence,
    matchSource: inferMatchSource(traits, breakdown),
    breakdown,
  };
}

export function findUsedDeviceWaitlistMatches(entry: UsedDeviceWaitlistEntryInput, products: CatalogProduct[]) {
  return products
    .map((product) => ({ product, result: matchUsedDeviceWaitlistEntryToProduct(entry, product) }))
    .filter((item) => item.result.isMatch)
    .sort((left, right) => {
      if (left.result.confidence !== right.result.confidence) {
        return right.result.confidence - left.result.confidence;
      }

      return left.product.price - right.product.price;
    });
}