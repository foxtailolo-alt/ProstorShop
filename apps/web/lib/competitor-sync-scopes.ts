export type CompetitorSyncScopeDefinition = {
  key: string;
  label: string;
  categorySlug: string | null;
};

export const COMPETITOR_SYNC_SCOPE_DEFINITIONS: CompetitorSyncScopeDefinition[] = [
  { key: "all", label: "Все Apple и Samsung", categorySlug: null },
  { key: "apple-iphone", label: "iPhone", categorySlug: "novye-ustroystva-apple-iphone" },
  { key: "apple-ipad", label: "iPad", categorySlug: "novye-ustroystva-apple-ipad" },
  { key: "apple-macbook", label: "MacBook", categorySlug: "novye-ustroystva-apple-macbook" },
  { key: "apple-airpods", label: "AirPods", categorySlug: "novye-ustroystva-apple-airpods" },
  { key: "apple-watch", label: "Apple Watch", categorySlug: "novye-ustroystva-apple-apple-watch" },
  { key: "samsung-smartphones", label: "Samsung смартфоны", categorySlug: "novye-ustroystva-samsung-smartfony" },
  { key: "samsung-watches", label: "Samsung часы", categorySlug: "novye-ustroystva-samsung-chasy" },
  { key: "samsung-tablets", label: "Samsung планшеты", categorySlug: "novye-ustroystva-samsung-planshety" },
  { key: "samsung-audio", label: "Samsung наушники", categorySlug: "novye-ustroystva-samsung-naushniki" },
];

export function getCompetitorSyncScopeDefinition(scopeKey?: string | null) {
  return COMPETITOR_SYNC_SCOPE_DEFINITIONS.find((scope) => scope.key === scopeKey) ?? COMPETITOR_SYNC_SCOPE_DEFINITIONS[0]!;
}