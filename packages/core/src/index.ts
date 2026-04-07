import { z } from "zod";
export * from "./catalog";
export * from "./pricing";

export const siteConfig = {
  name: "ProstorShop",
  legalName: "Простор",
  description:
    "SEO-first electronics storefront for iPhone, Samsung, MacBook, iPad, accessories, trade-in, and service requests.",
  categories: ["iphone", "samsung", "macbook", "ipad", "accessories"] as const,
  primaryColor: "#b9d6ff",
} as const;

export const featureFlagSchema = z.object({
  tradeInEnabled: z.boolean().default(true),
  serviceEnabled: z.boolean().default(true),
  telegramMiniAppEnabled: z.boolean().default(true),
  checkoutEnabled: z.boolean().default(true),
  yandexMetricaEnabled: z.boolean().default(true),
});

export type FeatureFlags = z.infer<typeof featureFlagSchema>;

export const defaultFeatureFlags: FeatureFlags = featureFlagSchema.parse({});

export const adminRoles = ["owner", "manager", "editor", "viewer"] as const;

export type AdminRole = (typeof adminRoles)[number];

export const customerPainPoints = [
  "Long registration before action",
  "Weak mobile UX",
  "Unclear stock or price status",
  "Hidden trade-in conditions",
  "Hard-to-find service pricing",
] as const;