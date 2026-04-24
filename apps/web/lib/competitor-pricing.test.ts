import { describe, expect, it } from "vitest";
import {
  buildTargetPriceFromCompetitor,
  COMPETITOR_PRICE_MARKUP_RUB,
  roundPriceToEnding700,
  TARGET_PRICE_ENDING_RUB,
} from "./competitor-pricing";

describe("competitor pricing helpers", () => {
  it("rounds to the nearest price ending with 700", () => {
    expect(roundPriceToEnding700(107990)).toBe(107700);
    expect(roundPriceToEnding700(108250)).toBe(108700);
    expect(roundPriceToEnding700(700)).toBe(700);
  });

  it("adds the fixed markup before rounding to ending 700", () => {
    expect(buildTargetPriceFromCompetitor(105990)).toBe(107700);
    expect(buildTargetPriceFromCompetitor(99900)).toBe(101700);
  });

  it("exposes the shared pricing constants", () => {
    expect(COMPETITOR_PRICE_MARKUP_RUB).toBe(2000);
    expect(TARGET_PRICE_ENDING_RUB).toBe(700);
  });

  it("rejects invalid competitor prices", () => {
    expect(() => buildTargetPriceFromCompetitor(0)).toThrow("Competitor price must be a positive finite number.");
    expect(() => roundPriceToEnding700(Number.NaN)).toThrow("Price must be a finite number.");
  });
});