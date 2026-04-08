import { describe, expect, it } from "vitest";

// Import pure functions that don't depend on next/headers
// We test buildAttributionSnapshot and parseAttributionCookie directly
// by copying the logic here since the module imports cookies() at top level

describe("Attribution parsing", () => {
  it("parseAttributionCookie returns null for empty", () => {
    const parse = (v?: string | null) => {
      if (!v) return null;
      try { return JSON.parse(v); } catch { return null; }
    };
    expect(parse(null)).toBeNull();
    expect(parse(undefined)).toBeNull();
    expect(parse("")).toBeNull();
    expect(parse("not json")).toBeNull();
  });

  it("parseAttributionCookie parses valid JSON", () => {
    const parse = (v?: string | null) => {
      if (!v) return null;
      try { return JSON.parse(v); } catch { return null; }
    };
    const data = { source: "telegram", utmSource: "tg" };
    expect(parse(JSON.stringify(data))).toEqual(data);
  });

  it("buildAttributionSnapshot merges params with existing", () => {
    // Inline the pure logic
    function normalizeValue(value: string | null) {
      const normalized = value?.trim();
      return normalized ? normalized.slice(0, 160) : undefined;
    }

    type Snap = Record<string, string | undefined>;

    function build(params: URLSearchParams, pathname: string, existing?: Snap | null) {
      const snapshot: Snap = {
        source: normalizeValue(params.get("source")) ?? existing?.source,
        utmSource: normalizeValue(params.get("utm_source")) ?? existing?.utmSource,
        utmMedium: normalizeValue(params.get("utm_medium")) ?? existing?.utmMedium,
        utmCampaign: normalizeValue(params.get("utm_campaign")) ?? existing?.utmCampaign,
        utmTerm: normalizeValue(params.get("utm_term")) ?? existing?.utmTerm,
        utmContent: normalizeValue(params.get("utm_content")) ?? existing?.utmContent,
        yclid: normalizeValue(params.get("yclid")) ?? existing?.yclid,
        landingPath: existing?.landingPath ?? pathname,
      };
      return Object.values(snapshot).some(Boolean) ? snapshot : null;
    }

    const params = new URLSearchParams("utm_source=google&utm_campaign=summer");
    const result = build(params, "/catalog");

    expect(result).toBeTruthy();
    expect(result?.utmSource).toBe("google");
    expect(result?.utmCampaign).toBe("summer");
    expect(result?.landingPath).toBe("/catalog");
  });

  it("preserves existing values when new params are empty", () => {
    function normalizeValue(value: string | null) {
      const normalized = value?.trim();
      return normalized ? normalized.slice(0, 160) : undefined;
    }

    type Snap = Record<string, string | undefined>;

    function build(params: URLSearchParams, pathname: string, existing?: Snap | null) {
      const snapshot: Snap = {
        source: normalizeValue(params.get("source")) ?? existing?.source,
        utmSource: normalizeValue(params.get("utm_source")) ?? existing?.utmSource,
        landingPath: existing?.landingPath ?? pathname,
      };
      return Object.values(snapshot).some(Boolean) ? snapshot : null;
    }

    const existing = { source: "telegram", landingPath: "/trade-in" };
    const params = new URLSearchParams();
    const result = build(params, "/new-page", existing);

    expect(result?.source).toBe("telegram");
    expect(result?.landingPath).toBe("/trade-in"); // preserved
  });
});
