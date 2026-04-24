import { chromium, type Browser, type Page } from "playwright";
import { buildTargetPriceFromCompetitor } from "./competitor-pricing";
import { normalizeProductOptionsOrder } from "./product-options-order";

export type ProductOptionsData = {
  groups: Array<{ name: string; values: string[] }>;
  allVariants: boolean;
  variants?: Array<{ name: string; price: number }>;
  prices?: Record<string, Record<string, number>>;
} | null;

type LocalProductRecord = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  price: number;
  options: unknown;
};

type OptionGroup = {
  name: string;
  values: string[];
};

type ScrapedVariant = {
  selections: Record<string, string>;
  price: number;
};

export type ScrapedCompetitorProduct = {
  url: string;
  title: string;
  basePrice: number;
  groups: OptionGroup[];
  variants: ScrapedVariant[];
};

export type CompetitorSyncProposal = {
  status: "pending" | "unmatched";
  matchConfidence: "high" | "medium" | "low" | "none";
  matchMethod: string;
  competitorUrl: string;
  competitorProductName: string;
  competitorBrand: string | null;
  competitorCategoryPath: string | null;
  competitorBasePrice: number;
  proposedBasePrice: number;
  competitorOptions: ProductOptionsData;
  proposedOptions: ProductOptionsData;
  currentVariantCount: number;
  proposedVariantCount: number;
  note: string | null;
};

const COMPETITOR_SITEMAP_URL = "https://resale52.ru/sitemap-store.xml";
const PAGE_TIMEOUT_MS = 90_000;

const COLOR_ALIASES: Record<string, string[]> = {
  black: ["black", "черный", "чёрный", "chernyy", "темный", "space black", "graphite", "midnight"],
  white: ["white", "белый", "belyy", "silver", "серебристый", "серебрянный", "serebryannyy", "serebristyj", "starlight", "сияющая звезда"],
  blue: ["blue", "sky blue", "deep blue", "голубой", "goluboy", "синий", "ultramarine", "navy", "indigo", "индиго"],
  green: ["green", "зеленый", "зелёный", "teal", "mint", "мятный"],
  yellow: ["yellow", "желтый", "жёлтый", "citrus", "цитрусовый"],
  pink: ["pink", "розовый", "blush"],
  purple: ["purple", "фиолетовый", "lavender"],
  orange: ["orange", "оранжевый", "cosmic orange"],
  beige: ["beige", "бежевый", "bezhevyy"],
  gray: ["gray", "grey", "серый", "space gray", "титановый"],
};

const COLOR_SUFFIX_ALIASES = uniqueValues(
  Object.values(COLOR_ALIASES)
    .flat()
    .map((alias) => normalizeComparableText(alias)),
).sort((left, right) => right.length - left.length);

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[+/,()]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeStorageValue(value: string) {
  return normalizeComparableText(value)
    .replace(/гб/g, "gb")
    .replace(/тб/g, "tb")
    .replace(/\s+/g, "");
}

function toSlugToken(value: string) {
  return normalizeComparableText(value).replace(/\s+/g, "-");
}

function stripTrailingColorSuffix(value: string, separator: " " | "-") {
  const normalizedValue = value.trim().replace(new RegExp(`\\${separator}+`, "g"), separator);

  for (const alias of COLOR_SUFFIX_ALIASES) {
    const normalizedAlias = alias.replace(/\s+/g, separator);

    if (normalizedValue === normalizedAlias) {
      return "";
    }

    const suffix = `${separator}${normalizedAlias}`;
    if (normalizedValue.endsWith(suffix)) {
      return normalizedValue.slice(0, -suffix.length).replace(new RegExp(`\\${separator}+$`, "g"), "");
    }
  }

  return normalizedValue;
}

function parseRubPrice(value: string) {
  const numericValue = Number(String(value).replace(/[^\d]+/g, ""));

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`Invalid competitor price: ${value}`);
  }

  return numericValue;
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cartesianProduct(groups: OptionGroup[]) {
  if (groups.length === 0) {
    return [{} as Record<string, string>];
  }

  return groups.reduce<Array<Record<string, string>>>(
    (accumulator, group) => {
      if (accumulator.length === 0) {
        return group.values.map((value) => ({ [group.name]: value }));
      }

      return accumulator.flatMap((entry) =>
        group.values.map((value) => ({
          ...entry,
          [group.name]: value,
        })),
      );
    },
    [],
  );
}

function countCurrentVariants(options: unknown) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return 0;
  }

  const data = options as {
    allVariants?: boolean;
    variants?: Array<{ name: string }>;
    prices?: Record<string, Record<string, number>>;
  };

  if (data.allVariants && Array.isArray(data.variants)) {
    return data.variants.length;
  }

  if (!data.prices || typeof data.prices !== "object") {
    return 0;
  }

  return Object.values(data.prices).reduce((count, group) => count + Object.keys(group ?? {}).length, 0);
}

function canonicalizeColor(value: string) {
  const normalized = normalizeComparableText(value);

  for (const [canonical, aliases] of Object.entries(COLOR_ALIASES)) {
    if (aliases.some((alias) => normalizeComparableText(alias) === normalized)) {
      return canonical;
    }
  }

  return null;
}

function isColorGroup(group: OptionGroup) {
  return group.values.some((value) => canonicalizeColor(value) !== null);
}

function isStorageGroup(group: OptionGroup) {
  return group.values.every((value) => /\d/.test(value));
}

function matchesOptionValue(localText: string, value: string, group: OptionGroup) {
  const normalizedLocalText = normalizeComparableText(localText);

  if (isColorGroup(group)) {
    const candidate = canonicalizeColor(value);
    if (!candidate) {
      return false;
    }

    const aliases = COLOR_ALIASES[candidate] ?? [];
    return aliases.some((alias) => ` ${normalizedLocalText} `.includes(` ${normalizeComparableText(alias)} `));
  }

  if (isStorageGroup(group)) {
    return normalizeStorageValue(localText).includes(normalizeStorageValue(value));
  }

  return ` ${normalizedLocalText} `.includes(` ${normalizeComparableText(value)} `);
}

function buildProductCandidateKeys(product: LocalProductRecord) {
  const candidates = new Set<string>();
  const slug = product.slug.toLowerCase();
  const normalizedName = stripTrailingColorSuffix(
    normalizeComparableText(product.name)
    .replace(/^apple\s+/g, "")
    .replace(/^samsung\s+/g, "")
    .trim(),
    " ",
  );

  const slugVariants = [
    slug,
    slug.replace(/^apple-/, ""),
    slug.replace(/^samsung-galaxy-/, "samsung-"),
    slug.replace(/^samsung-/, ""),
    slug.replace(/^galaxy-/, ""),
  ];

  for (const variant of slugVariants) {
    if (!variant) {
      continue;
    }

    candidates.add(variant);
    candidates.add(stripTrailingColorSuffix(variant, "-"));
  }

  if (normalizedName) {
    candidates.add(toSlugToken(normalizedName));
  }

  return [...candidates]
    .map((value) => value.replace(/--+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);
}

function isBrandCompatible(url: string, brand: string) {
  const normalizedBrand = brand.toLowerCase();
  if (normalizedBrand === "samsung") {
    return url.includes("/samsung/");
  }

  if (normalizedBrand === "apple") {
    return !url.includes("/samsung/");
  }

  return false;
}

export function matchCompetitorUrlForProduct(product: LocalProductRecord, urls: string[]) {
  const compatibleUrls = urls.filter((url) => isBrandCompatible(url, product.brand));
  const candidates = buildProductCandidateKeys(product);
  let bestMatch: { url: string; score: number } | null = null;

  for (const url of compatibleUrls) {
    const pathname = new URL(url).pathname.toLowerCase();
    const lastSegment = pathname.split("/").filter(Boolean).at(-1) ?? "";

    for (const candidate of candidates) {
      let score = 0;
      if (lastSegment === candidate) {
        score = 100;
      } else if (lastSegment.endsWith(candidate) || candidate.endsWith(lastSegment)) {
        score = 80;
      } else if (pathname.includes(`/${candidate}`) || pathname.includes(candidate.replace(/-/g, " "))) {
        score = 60;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = score > 0 ? { url, score } : bestMatch;
      }
    }
  }

  return bestMatch;
}

export async function fetchCompetitorSitemapUrls() {
  const response = await fetch(COMPETITOR_SITEMAP_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch competitor sitemap: ${response.status}`);
  }

  const xml = await response.text();
  return uniqueValues([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? ""));
}

async function launchCompetitorBrowser() {
  try {
    return await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHROME_CHANNEL ?? "chrome",
      headless: true,
    });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function readProductState(page: Page) {
  return page.evaluate(() => {
    const normalize = (value: string | null | undefined) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

    const root = document.querySelector(".js-store-single-product-info");
    if (!root) {
      throw new Error("Competitor product root not found.");
    }

    const groups = [...root.querySelectorAll(".js-product-edition-option")].map((groupNode) => {
      const groupName = normalize(
        groupNode.getAttribute("data-edition-option-id")
          || groupNode.querySelector(".js-product-edition-option-name")?.textContent,
      );
      const labels = [...groupNode.querySelectorAll("label")]
        .map((label) => normalize(label.textContent))
        .filter(Boolean);

      return {
        name: groupName,
        values: [...new Set(labels)],
      };
    }).filter((group) => group.name && group.values.length > 0);

    return {
      title: normalize(root.querySelector(".js-product-name")?.textContent),
      price: normalize(root.querySelector(".js-store-prod-price-val")?.textContent),
      groups,
    };
  });
}

async function clickOptionValue(page: Page, groupName: string, value: string) {
  await page.evaluate(({ groupName, value }) => {
    const normalize = (input: string | null | undefined) =>
      String(input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const root = document.querySelector(".js-store-single-product-info");
    if (!root) {
      throw new Error("Competitor product root not found.");
    }

    const group = [...root.querySelectorAll(".js-product-edition-option")].find((groupNode) => {
      const name = groupNode.getAttribute("data-edition-option-id")
        || groupNode.querySelector(".js-product-edition-option-name")?.textContent;
      return normalize(name) === normalize(groupName);
    });

    if (!group) {
      throw new Error(`Competitor option group not found: ${groupName}`);
    }

    const label = [...group.querySelectorAll("label")].find((labelNode) => normalize(labelNode.textContent) === normalize(value));

    if (!(label instanceof HTMLElement)) {
      throw new Error(`Competitor option value not found: ${groupName}=${value}`);
    }

    label.click();
    const input = label.querySelector("input");
    if (input instanceof HTMLInputElement) {
      input.click();
    }
  }, { groupName, value });

  await page.waitForFunction(
    ({ groupName, value }) => {
      const normalize = (input: string | null | undefined) =>
        String(input ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const root = document.querySelector(".js-store-single-product-info");
      if (!root) {
        return false;
      }

      const group = [...root.querySelectorAll(".js-product-edition-option")].find((groupNode) => {
        const name = groupNode.getAttribute("data-edition-option-id")
          || groupNode.querySelector(".js-product-edition-option-name")?.textContent;
        return normalize(name) === normalize(groupName);
      });

      if (!group) {
        return false;
      }

      return [...group.querySelectorAll("label")].some(
        (labelNode) => labelNode.classList.contains("t-product__option-item_active") && normalize(labelNode.textContent) === normalize(value),
      );
    },
    { groupName, value },
    { timeout: 5_000 },
  );

  await page.waitForTimeout(250);
}

export async function scrapeCompetitorProduct(browser: Browser, url: string): Promise<ScrapedCompetitorProduct> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.locator(".js-store-single-product-info .js-store-prod-price-val").first().waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => {
        const info = document.querySelector(".js-store-single-product-info");
        if (!info) {
          return false;
        }

        return info.querySelectorAll(".js-product-edition-option").length > 0;
      },
      undefined,
      { timeout: 8_000 },
    ).catch(() => undefined);
    await page.waitForTimeout(400);

    const initialState = await readProductState(page);
    const groups = initialState.groups.map((group) => ({
      name: group.name,
      values: uniqueValues(group.values),
    }));

    const variants = new Map<string, ScrapedVariant>();

    for (const selection of cartesianProduct(groups)) {
      for (const [groupName, value] of Object.entries(selection)) {
        await clickOptionValue(page, groupName, value);
      }

      const state = await readProductState(page);
      const variantName = groups.map((group) => selection[group.name]).filter(Boolean).join(" + ");
      variants.set(variantName, {
        selections: { ...selection },
        price: parseRubPrice(state.price),
      });
    }

    return {
      url,
      title: initialState.title,
      basePrice: parseRubPrice(initialState.price),
      groups,
      variants: [...variants.values()],
    };
  } finally {
    await page.close();
  }
}

export async function withCompetitorBrowser<T>(callback: (browser: Browser) => Promise<T>) {
  const browser = await launchCompetitorBrowser();

  try {
    return await callback(browser);
  } finally {
    await browser.close();
  }
}

export function buildProposalForProduct(
  product: LocalProductRecord,
  scraped: ScrapedCompetitorProduct,
  matchMethod: string,
  matchConfidence: CompetitorSyncProposal["matchConfidence"],
): CompetitorSyncProposal {
  const localText = `${product.name} ${product.slug}`;
  const fixedSelections = new Map<string, string>();

  for (const group of scraped.groups) {
    const matchedValue = group.values.find((value) => matchesOptionValue(localText, value, group));
    if (matchedValue) {
      fixedSelections.set(group.name, matchedValue);
    }
  }

  const matchedVariants = scraped.variants.filter((variant) =>
    [...fixedSelections.entries()].every(([groupName, value]) => variant.selections[groupName] === value),
  );

  const effectiveVariants = matchedVariants.length > 0 ? matchedVariants : scraped.variants;
  const remainingGroups = scraped.groups.filter((group) => !fixedSelections.has(group.name));
  const normalizedVariants = effectiveVariants
    .map((variant) => {
      const selections = Object.fromEntries(
        Object.entries(variant.selections).filter(([groupName]) => !fixedSelections.has(groupName)),
      );
      const name = remainingGroups.map((group) => selections[group.name]).filter(Boolean).join(" + ");

      return {
        name,
        price: buildTargetPriceFromCompetitor(variant.price),
      };
    })
    .filter((variant) => variant.name);

  const proposedOptions: ProductOptionsData = remainingGroups.length > 0
    ? normalizeProductOptionsOrder({
        groups: remainingGroups.map((group) => ({
          name: group.name,
          values: uniqueValues(
            effectiveVariants
              .map((variant) => variant.selections[group.name])
              .filter((value): value is string => Boolean(value)),
          ),
        })),
        allVariants: true,
        variants: normalizedVariants,
      })
    : null;

  const competitorOptions: ProductOptionsData = scraped.groups.length > 0
    ? normalizeProductOptionsOrder({
        groups: scraped.groups,
        allVariants: true,
        variants: scraped.variants.map((variant) => ({
          name: scraped.groups.map((group) => variant.selections[group.name]).filter(Boolean).join(" + "),
          price: variant.price,
        })),
      })
    : null;

  const competitorBasePrice = Math.min(...effectiveVariants.map((variant) => variant.price));
  const proposedBasePrice = buildTargetPriceFromCompetitor(competitorBasePrice);
  const fixedSelectionLabel = [...fixedSelections.entries()].map(([groupName, value]) => `${groupName}: ${value}`).join(", ");

  return {
    status: "pending",
    matchConfidence,
    matchMethod,
    competitorUrl: scraped.url,
    competitorProductName: scraped.title,
    competitorBrand: product.brand,
    competitorCategoryPath: new URL(scraped.url).pathname,
    competitorBasePrice,
    proposedBasePrice,
    competitorOptions,
    proposedOptions,
    currentVariantCount: countCurrentVariants(product.options),
    proposedVariantCount: proposedOptions?.variants?.length ?? 0,
    note: fixedSelectionLabel ? `Зафиксированы опции: ${fixedSelectionLabel}.` : null,
  };
}