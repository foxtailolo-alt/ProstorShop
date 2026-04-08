"use client";

import { useState } from "react";

type ProductOptionsData = {
  groups: Array<{ name: string; values: string[] }>;
  allVariants: boolean;
  variants?: Array<{ name: string; price: number }>;
  prices?: Record<string, Record<string, number>>;
};

type Props = {
  options: ProductOptionsData;
  basePrice: number;
  onPriceChange?: (price: number) => void;
  onVariantChange?: (label: string) => void;
};

export function ProductOptionPicker({ options, basePrice, onPriceChange, onVariantChange }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const group of options.groups) {
      if (group.values.length > 0) defaults[group.name] = group.values[0]!;
    }
    return defaults;
  });

  function handleSelect(groupName: string, value: string) {
    const next = { ...selected, [groupName]: value };
    setSelected(next);

    if (options.allVariants && options.variants) {
      const comboName = options.groups.map((g) => next[g.name]).join(" + ");
      const variant = options.variants.find((v) => v.name === comboName);
      if (variant && variant.price > 0) {
        onPriceChange?.(variant.price);
      } else {
        onPriceChange?.(basePrice);
      }
      onVariantChange?.(comboName);
    } else if (!options.allVariants && options.prices) {
      let total = basePrice;
      for (const group of options.groups) {
        const val = next[group.name];
        if (!val) continue;
        const add = options.prices[group.name]?.[val] ?? 0;
        total += add;
      }
      onPriceChange?.(total);
      const label = options.groups.map((g) => next[g.name]).join(" + ");
      onVariantChange?.(label);
    }
  }

  return (
    <div className="product-options">
      {options.groups.map((group) => (
        <div key={group.name} className="product-option-group">
          <span className="product-option-label">{group.name}</span>
          <div className="product-option-chips">
            {group.values.map((val) => (
              <button
                key={val}
                type="button"
                className={`product-option-chip ${selected[group.name] === val ? "product-option-chip-active" : ""}`}
                onClick={() => handleSelect(group.name, val)}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
