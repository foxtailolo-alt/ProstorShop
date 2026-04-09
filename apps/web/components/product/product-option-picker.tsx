"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (options.allVariants && options.variants) {
      const comboName = options.groups.map((group) => selected[group.name]).join(" + ");
      const variant = options.variants.find((entry) => entry.name === comboName);

      onPriceChange?.(variant && variant.price > 0 ? variant.price : basePrice);
      onVariantChange?.(comboName);
      return;
    }

    if (!options.allVariants && options.prices) {
      const total = options.groups.reduce((sum, group) => {
        const value = selected[group.name];
        const add = value ? options.prices?.[group.name]?.[value] ?? 0 : 0;
        return sum + add;
      }, basePrice);

      onPriceChange?.(total);
      onVariantChange?.(options.groups.map((group) => selected[group.name]).join(" + "));
    }
  }, [basePrice, onPriceChange, onVariantChange, options, selected]);

  function handleSelect(groupName: string, value: string) {
    setSelected((current) => ({ ...current, [groupName]: value }));
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
