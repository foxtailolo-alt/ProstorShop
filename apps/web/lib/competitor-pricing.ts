export const COMPETITOR_PRICE_MARKUP_RUB = 2000;
export const TARGET_PRICE_ENDING_RUB = 700;

export function roundPriceToEnding700(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Price must be a finite number.");
  }

  const normalizedValue = Math.max(0, Math.round(value));
  const lowerCandidate = Math.floor((normalizedValue - TARGET_PRICE_ENDING_RUB) / 1000) * 1000 + TARGET_PRICE_ENDING_RUB;
  const upperCandidate = lowerCandidate + 1000;

  if (lowerCandidate < 0) {
    return TARGET_PRICE_ENDING_RUB;
  }

  return Math.abs(normalizedValue - lowerCandidate) <= Math.abs(upperCandidate - normalizedValue)
    ? lowerCandidate
    : upperCandidate;
}

export function buildTargetPriceFromCompetitor(competitorPrice: number) {
  if (!Number.isFinite(competitorPrice) || competitorPrice <= 0) {
    throw new Error("Competitor price must be a positive finite number.");
  }

  return roundPriceToEnding700(competitorPrice + COMPETITOR_PRICE_MARKUP_RUB);
}