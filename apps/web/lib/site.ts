import { getCatalogSummary, siteConfig } from "@prostor/core";

export function getNavigation(flags: {
  tradeInEnabled: boolean;
  serviceEnabled: boolean;
  telegramMiniAppEnabled: boolean;
  checkoutEnabled: boolean;
}) {
  return [
    { href: "/catalog", label: "Каталог" },
    flags.tradeInEnabled ? { href: "/trade-in", label: "Trade-in" } : null,
    flags.serviceEnabled ? { href: "/service", label: "Сервис" } : null,
    flags.checkoutEnabled ? { href: "/cart", label: "Корзина" } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));
}

export const siteMetadata = {
  title: `${siteConfig.legalName} — магазин техники`,
  description: "iPhone, Samsung, MacBook, iPad и аксессуары. Честные цены, trade-in, сервис и доставка.",
};

export const catalogSummary = getCatalogSummary();