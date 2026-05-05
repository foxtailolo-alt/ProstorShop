import type { CatalogProduct } from "@prostor/core";
import { getCategoryPath, type CategoryTreeNode } from "./data/catalog";

type UserDeviceSuggestionInput = {
  categoryCode: string;
  brand: string;
  model: string;
  storage: string | null;
  estimatedTradeInValue: number;
};

export type DeviceFamily = "iphone" | "samsung" | "ipad" | "mac" | "apple_watch";

export type UpgradeSuggestion = {
  slug: string;
  categorySlug: string;
  name: string;
  brand: string;
  imageUrl?: string;
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
  inventoryKind: "new" | "trade-in";
  inventoryLabel: string;
  finalPriceAfterTradeIn: number;
  matchScore: number;
};

export type UsedInventoryCandidate = {
  slug: string;
  categorySlug: string;
  name: string;
  brand: string;
  imageUrl?: string;
  price: number;
};

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9+\s]/gi, " ").replace(/\s+/g, " ").trim();
}

export function extractStorageValue(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = normalizeText(value);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(тб|tb|гб|gb)/i);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]?.replace(",", "."));
  const unit = match[2]?.toLowerCase();
  if (!Number.isFinite(amount) || !unit) {
    return 0;
  }

  return unit === "тб" || unit === "tb" ? amount * 1024 : amount;
}

function detectInventoryKind(product: CatalogProduct, categoryTree: CategoryTreeNode[]) {
  const path = getCategoryPath(categoryTree, product.categorySlug);
  const rootSlug = path[0]?.slug ?? "";
  if (rootSlug.startsWith("trade-in")) {
    return { kind: "trade-in" as const, label: "Trade-in" };
  }

  return { kind: "new" as const, label: "Новый" };
}

export function getCategoryCodeFamily(categoryCode: string): DeviceFamily | null {
  switch (categoryCode) {
    case "iphone":
      return "iphone";
    case "samsung":
      return "samsung";
    case "ipad":
      return "ipad";
    case "mac":
      return "mac";
    case "apple_watch":
      return "apple_watch";
    default:
      return null;
  }
}

export function inferDeviceFamilyFromProductText(name: string, brand: string) {
  const normalizedName = normalizeText(name);
  const normalizedBrand = normalizeText(brand);

  if (normalizedName.includes("iphone")) return "iphone";
  if (normalizedName.includes("galaxy") || normalizedName.includes("samsung") || normalizedName.includes("z flip") || normalizedName.includes("zfold") || normalizedName.includes("z fold")) return "samsung";
  if (normalizedName.includes("ipad")) return "ipad";
  if (normalizedName.includes("macbook") || normalizedName.includes("imac")) return "mac";
  if (normalizedName.includes("watch") && (normalizedBrand.includes("apple") || normalizedName.includes("apple watch") || normalizedName.includes("ultra"))) return "apple_watch";

  if (normalizedBrand.includes("apple") && normalizedName.includes("watch")) return "apple_watch";
  return null;
}

export function extractStorageLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(ТБ|TB|ГБ|GB)/i);
  if (!match) {
    return null;
  }

  const amount = match[1]?.replace(/\.0$/, "") ?? null;
  const unit = match[2]?.toUpperCase() ?? null;
  if (!amount || !unit) {
    return null;
  }

  return `${amount} ${unit}`;
}

function getDeviceFamily(input: UserDeviceSuggestionInput) {
  return getCategoryCodeFamily(input.categoryCode);
}

export function getProductFamily(product: CatalogProduct): DeviceFamily | null {
  return inferDeviceFamilyFromProductText(product.name, product.brand);
}

function extractIphoneRank(value: string) {
  const normalized = normalizeText(value);
  const series = Number(normalized.match(/iphone\s+(\d{1,2})/)?.[1] ?? 0);
  const tier = normalized.includes("pro max") ? 40 : normalized.includes("pro") ? 30 : normalized.includes("plus") ? 20 : normalized.includes("air") ? 15 : normalized.includes("e") ? 5 : 10;
  return series * 100 + tier;
}

function extractSamsungRank(value: string) {
  const normalized = normalizeText(value);
  const familyBase = normalized.includes("fold") ? 900 : normalized.includes("flip") ? 800 : normalized.includes("ultra") ? 700 : normalized.includes("s") ? 600 : normalized.includes("a") ? 400 : 100;
  const series = Number(normalized.match(/(?:fold|flip|s|a)\s*(\d{1,2})/)?.[1] ?? 0);
  const tier = normalized.includes("ultra") ? 40 : normalized.includes("plus") ? 20 : 10;
  return familyBase + series * 10 + tier;
}

function extractIpadRank(value: string) {
  const normalized = normalizeText(value);
  const familyBase = normalized.includes("pro") ? 800 : normalized.includes("air") ? 500 : 200;
  const chip = Number(normalized.match(/m(\d)/)?.[1] ?? 0);
  const size = Number(normalized.match(/\b(11|13)\b/)?.[1] ?? 0);
  return familyBase + chip * 20 + size;
}

function extractMacRank(value: string) {
  const normalized = normalizeText(value);
  const familyBase = normalized.includes("pro") ? 800 : normalized.includes("air") ? 500 : normalized.includes("imac") ? 650 : 200;
  const chip = Number(normalized.match(/m(\d)/)?.[1] ?? 0);
  const chipTier = normalized.includes("max") ? 30 : normalized.includes("pro") ? 20 : 10;
  const size = Number(normalized.match(/\b(13|14|15|16|24)\b/)?.[1] ?? 0);
  return familyBase + chip * 20 + chipTier + size;
}

function extractWatchRank(value: string) {
  const normalized = normalizeText(value);
  const familyBase = normalized.includes("ultra") ? 800 : normalized.includes("se") ? 300 : 500;
  const series = Number(normalized.match(/(?:s|se|ultra)\s*(\d{1,2})/)?.[1] ?? 0);
  const size = Number(normalized.match(/\b(40|41|42|44|45|46|49)\b/)?.[1] ?? 0);
  return familyBase + series * 10 + size;
}

export function getModelRank(family: DeviceFamily | null, value: string) {
  switch (family) {
    case "iphone":
      return extractIphoneRank(value);
    case "samsung":
      return extractSamsungRank(value);
    case "ipad":
      return extractIpadRank(value);
    case "mac":
      return extractMacRank(value);
    case "apple_watch":
      return extractWatchRank(value);
    default:
      return 0;
  }
}

export function buildCurrentDeviceRankLabel(family: DeviceFamily, device: Pick<UserDeviceSuggestionInput, "model">) {
  switch (family) {
    case "iphone":
      return `iphone ${device.model}`;
    case "samsung":
      return `samsung ${device.model}`;
    case "ipad":
      return `ipad ${device.model}`;
    case "mac":
      return `macbook ${device.model}`;
    case "apple_watch":
      return `apple watch ${device.model}`;
  }
}

export function buildUpgradeSuggestions(
  device: UserDeviceSuggestionInput,
  products: CatalogProduct[],
  categoryTree: CategoryTreeNode[],
) {
  const family = getDeviceFamily(device);
  if (!family) {
    return [] as UpgradeSuggestion[];
  }

  const currentRank = getModelRank(family, buildCurrentDeviceRankLabel(family, device));
  const currentStorage = extractStorageValue(device.storage);

  const matchingProducts = products
    .filter((product) => product.inStock)
    .filter((product) => getProductFamily(product) === family)
    .filter((product) => getModelRank(family, product.name) > currentRank)
    .map((product) => {
      const inventory = detectInventoryKind(product, categoryTree);
      const rank = getModelRank(family, product.name);
      const productStorage = extractStorageValue(`${product.name} ${product.attributes?.storage ?? ""}`);
      const storageScore = productStorage >= currentStorage ? 15 : 0;
      const inventoryScore = inventory.kind === "new" ? 20 : 10;
      const upgradeScore = 80 + Math.max(0, rank - currentRank);
      const priceScore = product.price >= device.estimatedTradeInValue ? Math.min(20, Math.round((product.price - device.estimatedTradeInValue) / 10000)) : 0;

      return {
        slug: product.slug,
        categorySlug: product.categorySlug,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        inStock: product.inStock,
        inventoryKind: inventory.kind,
        inventoryLabel: inventory.label,
        finalPriceAfterTradeIn: Math.max(0, product.price - device.estimatedTradeInValue),
        matchScore: upgradeScore + storageScore + inventoryScore + priceScore,
      } satisfies UpgradeSuggestion;
    })
    .sort((left, right) => {
      if (left.matchScore !== right.matchScore) {
        return right.matchScore - left.matchScore;
      }

      if (left.inventoryKind !== right.inventoryKind) {
        return left.inventoryKind === "new" ? -1 : 1;
      }

      return left.price - right.price;
    });

  const distinctBySlug = new Map<string, UpgradeSuggestion>();
  for (const product of matchingProducts) {
    if (!distinctBySlug.has(product.slug)) {
      distinctBySlug.set(product.slug, product);
    }
  }

  const distinctProducts = Array.from(distinctBySlug.values());
  const newProducts = distinctProducts.filter((product) => product.inventoryKind === "new").slice(0, 3);
  const tradeInProducts = distinctProducts.filter((product) => product.inventoryKind === "trade-in").slice(0, 3);

  return [...newProducts, ...tradeInProducts].slice(0, 6);
}

export function findUsedInventoryCandidates(
  device: UserDeviceSuggestionInput,
  products: CatalogProduct[],
  categoryTree: CategoryTreeNode[],
) {
  const family = getDeviceFamily(device);
  if (!family) {
    return [] as UsedInventoryCandidate[];
  }

  const currentRank = getModelRank(family, buildCurrentDeviceRankLabel(family, device));
  const currentStorage = extractStorageValue(device.storage);

  return products
    .filter((product) => product.inStock)
    .filter((product) => getProductFamily(product) === family)
    .filter((product) => detectInventoryKind(product, categoryTree).kind === "trade-in")
    .filter((product) => getModelRank(family, product.name) > currentRank)
    .map((product) => ({
      product,
      productStorage: extractStorageValue(`${product.name} ${product.attributes?.storage ?? ""}`),
    }))
    .sort((left, right) => {
      const leftStorageDelta = Math.abs(left.productStorage - currentStorage);
      const rightStorageDelta = Math.abs(right.productStorage - currentStorage);

      if (leftStorageDelta !== rightStorageDelta) {
        return leftStorageDelta - rightStorageDelta;
      }

      return left.product.price - right.product.price;
    })
    .slice(0, 3)
    .map(({ product }) => ({
      slug: product.slug,
      categorySlug: product.categorySlug,
      name: product.name,
      brand: product.brand,
      imageUrl: product.imageUrl,
      price: product.price,
    }));
}