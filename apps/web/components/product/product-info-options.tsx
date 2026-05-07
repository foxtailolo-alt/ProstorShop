"use client";

import { useMemo, useState } from "react";
import { AddToCartButton } from "../cart/add-to-cart-button";
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
  productName: string;
  slug: string;
  categorySlug: string;
  addToCartAction: (formData: FormData) => Promise<{ cartCount: number; productSlug: string }>;
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
  productName,
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

      <div className="product-page-actions">
        <AddToCartButton
          addToCartAction={addToCartAction}
          productSlug={slug}
          productName={productName}
          variantLabel={variantLabel}
          className="button button-primary button-lg"
          label="Добавить в корзину"
          pendingLabel="Добавляем в корзину..."
        />
      </div>
    </>
  );
}
