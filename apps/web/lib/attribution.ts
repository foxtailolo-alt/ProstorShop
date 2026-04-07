import { cookies } from "next/headers";

export const attributionCookieName = "prostor_attribution";

export type AttributionSnapshot = {
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  yclid?: string;
  landingPath?: string;
  capturedAt?: string;
};

function normalizeValue(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 160) : undefined;
}

export function parseAttributionCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AttributionSnapshot;
  } catch {
    return null;
  }
}

export function buildAttributionSnapshot(searchParams: URLSearchParams, pathname: string, existing?: AttributionSnapshot | null) {
  const snapshot: AttributionSnapshot = {
    source: normalizeValue(searchParams.get("source")) ?? existing?.source,
    utmSource: normalizeValue(searchParams.get("utm_source")) ?? existing?.utmSource,
    utmMedium: normalizeValue(searchParams.get("utm_medium")) ?? existing?.utmMedium,
    utmCampaign: normalizeValue(searchParams.get("utm_campaign")) ?? existing?.utmCampaign,
    utmTerm: normalizeValue(searchParams.get("utm_term")) ?? existing?.utmTerm,
    utmContent: normalizeValue(searchParams.get("utm_content")) ?? existing?.utmContent,
    yclid: normalizeValue(searchParams.get("yclid")) ?? existing?.yclid,
    landingPath: existing?.landingPath ?? pathname,
    capturedAt: existing?.capturedAt ?? new Date().toISOString(),
  };

  return Object.values(snapshot).some(Boolean) ? snapshot : null;
}

export async function getAttributionSnapshot() {
  const cookieStore = await cookies();
  return parseAttributionCookie(cookieStore.get(attributionCookieName)?.value);
}

export function getAttributionEntries(snapshot: AttributionSnapshot | null) {
  if (!snapshot) {
    return [];
  }

  return [
    snapshot.source ? { label: "Source", value: snapshot.source } : null,
    snapshot.utmSource ? { label: "UTM Source", value: snapshot.utmSource } : null,
    snapshot.utmMedium ? { label: "UTM Medium", value: snapshot.utmMedium } : null,
    snapshot.utmCampaign ? { label: "Campaign", value: snapshot.utmCampaign } : null,
    snapshot.yclid ? { label: "YCLID", value: snapshot.yclid } : null,
    snapshot.landingPath ? { label: "Landing", value: snapshot.landingPath } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));
}