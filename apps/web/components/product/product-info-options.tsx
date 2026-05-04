"use client";

import { useMemo, useState } from "react";
import { ProductOptionPicker } from "./product-option-picker";
import { resolveProductPrice } from "../../lib/pricing";

type ProductOptionsData = {
  groups: Array<{ name: string; values: string[] }>;
  allVariants: boolean;
  variants?: Array<{ name: string; price: number }>;
  prices?: Record<string, Record<string, number>>;
};

type Props = {
  options: ProductOptionsData;
  basePrice: number;
  compareAtPrice?: number;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  discountEndsAt?: string;
  badge?: string;
  inStock: boolean;
  slug: string;
  categorySlug: string;
  addToCartAction: (formData: FormData) => void;
};

export function ProductInfoWithOptions({
  options,
  basePrice,
  compareAtPrice,
  discountType,
  discountValue,
  discountEndsAt,
  badge,
  inStock,
  slug,
  categorySlug,
  addToCartAction,
}: Props) {
  const [rawDisplayPrice, setRawDisplayPrice] = useState(compareAtPrice ?? basePrice);
  const [variantLabel, setVariantLabel] = useState("");
  const displayPricing = useMemo(() => resolveProductPrice({
    basePrice: rawDisplayPrice,
    discountType,
    discountValue,
    discountEndsAt,
  }), [discountEndsAt, discountType, discountValue, rawDisplayPrice]);

  return (
    <>
      <ProductOptionPicker
        options={options}
        basePrice={compareAtPrice ?? basePrice}
        onPriceChange={setRawDisplayPrice}
        onVariantChange={setVariantLabel}
      />

      <div className="product-page-price-block">
        <span className="product-page-price">{displayPricing.price.toLocaleString("ru-RU")} ₽</span>
        {displayPricing.compareAtPrice ? (
          <span className="product-card-old-price">{displayPricing.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
        ) : null}
        {badge ? <span className="product-card-badge-inline">{badge}</span> : null}
      </div>

      <div className="product-page-stock">
        {inStock ? "✓ В наличии" : "Под заказ"}
      </div>

      <form action={addToCartAction} className="product-page-actions">
        <input type="hidden" name="productSlug" value={slug} />
        <input type="hidden" name="quantity" value="1" />
        <input type="hidden" name="variant" value={variantLabel} />
        <input type="hidden" name="variantPrice" value={displayPricing.price} />
        <input type="hidden" name="redirectTo" value={`/catalog/${categorySlug}/${slug}`} />
        <button className="button button-primary button-lg" type="submit">
          Добавить в корзину
        </button>
      </form>
    </>
  );
}
