import { notFound, redirect } from "next/navigation";
import { findCatalogProductBySlug, getRuntimeFeatureFlags } from "../../../lib/data/catalog";

type MiniAppPageProps = {
  searchParams?: Promise<{
    added?: string;
    product?: string;
    source?: string;
    tgWebAppStartParam?: string;
  }>;
};

export default async function MiniAppPage({ searchParams }: MiniAppPageProps) {
  const featureFlags = await getRuntimeFeatureFlags();

  if (!featureFlags.telegramMiniAppEnabled) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const directProductSlug = resolvedSearchParams?.tgWebAppStartParam?.trim();
  const productSlug = resolvedSearchParams?.product?.trim() ?? directProductSlug;
  const source = resolvedSearchParams?.source?.trim() ?? (directProductSlug ? "telegram-post" : "telegram-mini-app");
  const product = productSlug ? await findCatalogProductBySlug(productSlug) : null;

  if (product) {
    redirect(`/catalog/${product.categorySlug}/${product.slug}?source=${encodeURIComponent(source)}`);
  }

  redirect(`/?source=${encodeURIComponent(source)}`);
}