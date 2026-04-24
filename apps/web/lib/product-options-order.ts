type ProductOptionsData = {
  groups: Array<{ name: string; values: string[] }>;
  allVariants: boolean;
  variants?: Array<{ name: string; price: number }>;
  prices?: Record<string, Record<string, number>>;
};

function getStorageRank(value: string) {
  const matches = [...value.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*(tb|gb)/g)];
  const match = matches.at(-1);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]?.replace(",", "."));
  const unit = match[2];

  if (!Number.isFinite(amount) || !unit) {
    return null;
  }

  return unit === "tb" ? amount * 1024 : amount;
}

function sortStorageValues(values: string[]) {
  const rankedValues = values.map((value, index) => ({
    value,
    index,
    rank: getStorageRank(value),
  }));

  if (rankedValues.some((entry) => entry.rank === null)) {
    return values;
  }

  return rankedValues
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return (left.rank ?? 0) - (right.rank ?? 0);
      }

      return left.index - right.index;
    })
    .map((entry) => entry.value);
}

export function normalizeProductOptionsOrder(options: ProductOptionsData): ProductOptionsData {
  return {
    ...options,
    groups: options.groups.map((group) => ({
      ...group,
      values: sortStorageValues(group.values),
    })),
  };
}