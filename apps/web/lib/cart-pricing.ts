import type { CartItem } from "./cart";

export const ACCESSORY_BUNDLE_DISCOUNT_PERCENT = 20;

type ProductLike = {
  slug: string;
  categorySlug: string;
};

type CartEntryProduct<TProduct extends ProductLike> = {
  item: CartItem;
  product: TProduct;
  quantity: number;
  baseUnitPrice: number;
  effectiveUnitPrice: number;
  subtotal: number;
  isAccessory: boolean;
  hasBundleDiscount: boolean;
  compareAtUnitPrice?: number;
  bundleDiscountPercent?: number;
};

export function isAccessoryProduct(product: Pick<ProductLike, "categorySlug">) {
  return product.categorySlug === "accessories" || /accessor|aksess|аксесс/i.test(product.categorySlug);
}

export function hasDeviceInCart(products: Array<Pick<ProductLike, "categorySlug">>) {
  return products.some((product) => !isAccessoryProduct(product));
}

export function roundAccessoryBundlePrice(baseDiscountedPrice: number) {
  const normalizedPrice = Math.max(0, Math.round(baseDiscountedPrice));

  if (normalizedPrice <= 0) {
    return 0;
  }

  const lowerCandidate = Math.max(100, Math.floor((normalizedPrice - 100) / 1000) * 1000 + 100);
  const upperCandidate = Math.max(100, lowerCandidate + 1000);

  return Math.abs(upperCandidate - normalizedPrice) < Math.abs(normalizedPrice - lowerCandidate)
    ? upperCandidate
    : lowerCandidate;
}

export function resolveAccessoryBundlePricing(basePrice: number) {
  const roundedBasePrice = Math.max(0, Math.round(basePrice));
  const discountedRawPrice = roundedBasePrice * (1 - ACCESSORY_BUNDLE_DISCOUNT_PERCENT / 100);
  const discountedPrice = roundAccessoryBundlePrice(discountedRawPrice);

  return {
    compareAtPrice: roundedBasePrice,
    discountedPrice: discountedPrice > 0 && discountedPrice < roundedBasePrice ? discountedPrice : roundedBasePrice,
    discountPercent: ACCESSORY_BUNDLE_DISCOUNT_PERCENT,
  };
}

export function buildCartEntriesWithPricing<TProduct extends ProductLike>(input: {
  cartItems: CartItem[];
  products: TProduct[];
}) {
  const productMap = new Map(input.products.map((product) => [product.slug, product]));
  const rawEntries = input.cartItems
    .map((item) => {
      const product = productMap.get(item.productSlug);

      if (!product) {
        return null;
      }

      return {
        item,
        product,
      };
    })
    .filter((entry): entry is { item: CartItem; product: TProduct } => Boolean(entry));

  const bundleDiscountActive = hasDeviceInCart(rawEntries.map((entry) => entry.product));

  return rawEntries.map(({ item, product }) => {
    const quantity = item.quantity;
    const baseUnitPrice = item.unitPrice;
    const isAccessory = isAccessoryProduct(product);
    const bundlePricing = isAccessory && bundleDiscountActive
      ? resolveAccessoryBundlePricing(baseUnitPrice)
      : null;
    const effectiveUnitPrice = bundlePricing?.discountedPrice ?? baseUnitPrice;

    return {
      item,
      product,
      quantity,
      baseUnitPrice,
      effectiveUnitPrice,
      subtotal: effectiveUnitPrice * quantity,
      isAccessory,
      hasBundleDiscount: Boolean(bundlePricing),
      compareAtUnitPrice: bundlePricing?.compareAtPrice,
      bundleDiscountPercent: bundlePricing?.discountPercent,
    } satisfies CartEntryProduct<TProduct>;
  });
}