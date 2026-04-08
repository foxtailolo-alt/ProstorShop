"use client";

import { useState } from "react";
import { ProductOptionPicker } from "./product-option-picker";

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
  badge,
  inStock,
  slug,
  categorySlug,
  addToCartAction,
}: Props) {
  const [displayPrice, setDisplayPrice] = useState(basePrice);
  const [variantLabel, setVariantLabel] = useState("");

  return (
    <>
      <ProductOptionPicker
        options={options}
        basePrice={basePrice}
        onPriceChange={setDisplayPrice}
        onVariantChange={setVariantLabel}
      />

      <div className="product-page-price-block">
        <span className="product-page-price">{displayPrice.toLocaleString("ru-RU")} ₽</span>
        {compareAtPrice ? (
          <span className="product-card-old-price">{compareAtPrice.toLocaleString("ru-RU")} ₽</span>
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
        <input type="hidden" name="variantPrice" value={displayPrice} />
        <input type="hidden" name="redirectTo" value={`/catalog/${categorySlug}/${slug}`} />
        <button className="button button-primary button-lg" type="submit">
          Добавить в корзину
        </button>
      </form>
    </>
  );
}
