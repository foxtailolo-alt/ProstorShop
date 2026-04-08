"use server";

import { prisma } from "@prostor/db";

type PeriodDays = 7 | 30 | 90;

function dateFrom(days: PeriodDays) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

type AttributionJson = {
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  yclid?: string;
  landingPath?: string;
};

function extractAttribution(value: unknown): AttributionJson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AttributionJson;
}

export type ChannelStat = {
  channel: string;
  orders: number;
  tradeIn: number;
  service: number;
  total: number;
};

export type CampaignStat = {
  campaign: string;
  count: number;
};

export type MarketingStats = {
  channels: ChannelStat[];
  campaigns: CampaignStat[];
  yclidOrders: number;
  totalOrders: number;
  totalTradeIn: number;
  totalService: number;
};

export async function getMarketingStats(days: PeriodDays): Promise<MarketingStats> {
  const since = dateFrom(days);

  const [orders, tradeInRequests, serviceRequests] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { attribution: true },
    }),
    prisma.tradeInRequest.findMany({
      where: { createdAt: { gte: since } },
      select: { attribution: true },
    }),
    prisma.serviceRequest.findMany({
      where: { createdAt: { gte: since } },
      select: { attribution: true },
    }),
  ]);

  const channelMap = new Map<string, { orders: number; tradeIn: number; service: number }>();

  function incrementChannel(channel: string, type: "orders" | "tradeIn" | "service") {
    const entry = channelMap.get(channel) ?? { orders: 0, tradeIn: 0, service: 0 };
    entry[type]++;
    channelMap.set(channel, entry);
  }

  const campaignMap = new Map<string, number>();
  let yclidOrders = 0;

  for (const order of orders) {
    const attr = extractAttribution(order.attribution);
    const channel = attr?.utmSource || attr?.source || "Прямой заход";
    incrementChannel(channel, "orders");
    if (attr?.utmCampaign) {
      campaignMap.set(attr.utmCampaign, (campaignMap.get(attr.utmCampaign) ?? 0) + 1);
    }
    if (attr?.yclid) {
      yclidOrders++;
    }
  }

  for (const request of tradeInRequests) {
    const attr = extractAttribution(request.attribution);
    const channel = attr?.utmSource || attr?.source || "Прямой заход";
    incrementChannel(channel, "tradeIn");
  }

  for (const request of serviceRequests) {
    const attr = extractAttribution(request.attribution);
    const channel = attr?.utmSource || attr?.source || "Прямой заход";
    incrementChannel(channel, "service");
  }

  const channels: ChannelStat[] = Array.from(channelMap.entries())
    .map(([channel, counts]) => ({
      channel,
      ...counts,
      total: counts.orders + counts.tradeIn + counts.service,
    }))
    .sort((a, b) => b.total - a.total);

  const campaigns: CampaignStat[] = Array.from(campaignMap.entries())
    .map(([campaign, count]) => ({ campaign, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    channels,
    campaigns,
    yclidOrders,
    totalOrders: orders.length,
    totalTradeIn: tradeInRequests.length,
    totalService: serviceRequests.length,
  };
}
