export type ProductOptionsData = {
  groups: Array<{ name: string; values: string[] }>;
  allVariants: boolean;
  variants?: Array<{ name: string; price: number }>;
  prices?: Record<string, Record<string, number>>;
};

export function parseProductOptions(value: unknown): ProductOptionsData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const options = value as ProductOptionsData;

  if (!Array.isArray(options.groups) || options.groups.length === 0) {
    return null;
  }

  return options;
}

export function getDefaultVariantLabel(options: ProductOptionsData) {
  const defaultValues = options.groups.map((group) => group.values[0]).filter((value): value is string => Boolean(value));

  return defaultValues.length === options.groups.length ? defaultValues.join(" + ") : "";
}

export function resolveVariantSelection(basePrice: number, options: ProductOptionsData | null, requestedVariant: string) {
  if (!options) {
    return {
      variantLabel: undefined,
      unitPrice: basePrice,
    };
  }

  const fallbackValues = options.groups.map((group) => group.values[0] ?? "");
  const requestedValues = requestedVariant
    ? requestedVariant.split(" + ").map((value) => value.trim())
    : [];
  const selectedValues = requestedValues.length === options.groups.length
    ? options.groups.map((group, index) => {
        const candidate = requestedValues[index] ?? "";
        return group.values.includes(candidate) ? candidate : (group.values[0] ?? "");
      })
    : fallbackValues;
  const variantLabel = selectedValues.every(Boolean) ? selectedValues.join(" + ") : undefined;

  if (!variantLabel) {
    return {
      variantLabel: undefined,
      unitPrice: basePrice,
    };
  }

  if (options.allVariants) {
    const variant = options.variants?.find((entry) => entry.name === variantLabel);

    return {
      variantLabel,
      unitPrice: variant && Number.isFinite(variant.price) && variant.price > 0 ? variant.price : basePrice,
    };
  }

  const unitPrice = options.groups.reduce((sum, group, index) => {
    const value = selectedValues[index];
    const add = value ? options.prices?.[group.name]?.[value] ?? 0 : 0;
    return sum + add;
  }, basePrice);

  return {
    variantLabel,
    unitPrice,
  };
}