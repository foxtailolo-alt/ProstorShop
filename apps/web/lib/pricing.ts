export type ProductDiscountType = "percent" | "fixed";

export type ProductDiscountInput = {
  basePrice: number;
  discountType?: string | null;
  discountValue?: number | null;
  discountStartsAt?: Date | string | null;
  discountEndsAt?: Date | string | null;
  now?: Date;
};

export type ResolvedProductPrice = {
  price: number;
  compareAtPrice?: number;
  isDiscountActive: boolean;
  discountEndsAt?: Date;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function roundPrice(value: number) {
  return Math.max(0, Math.round(value));
}

export function roundProductPrice(value: number) {
  return roundPrice(value);
}

function isSupportedDiscountType(value: string | null | undefined): value is ProductDiscountType {
  return value === "percent" || value === "fixed";
}

export function resolveProductPrice(input: ProductDiscountInput): ResolvedProductPrice {
  const basePrice = roundPrice(input.basePrice);
  const startsAt = toDate(input.discountStartsAt);
  const endsAt = toDate(input.discountEndsAt);
  const now = input.now ?? new Date();
  const discountValue = typeof input.discountValue === "number" && Number.isFinite(input.discountValue)
    ? input.discountValue
    : null;

  if (!isSupportedDiscountType(input.discountType) || discountValue === null || discountValue <= 0) {
    return {
      price: basePrice,
      isDiscountActive: false,
    };
  }

  if (startsAt && startsAt.getTime() > now.getTime()) {
    return {
      price: basePrice,
      isDiscountActive: false,
      discountEndsAt: endsAt,
    };
  }

  if (endsAt && endsAt.getTime() < now.getTime()) {
    return {
      price: basePrice,
      isDiscountActive: false,
      discountEndsAt: endsAt,
    };
  }

  const discountedPrice = input.discountType === "percent"
    ? roundPrice(basePrice * (1 - discountValue / 100))
    : roundPrice(basePrice - discountValue);

  if (discountedPrice <= 0 || discountedPrice >= basePrice) {
    return {
      price: basePrice,
      isDiscountActive: false,
      discountEndsAt: endsAt,
    };
  }

  return {
    price: discountedPrice,
    compareAtPrice: basePrice,
    isDiscountActive: true,
    discountEndsAt: endsAt,
  };
}

export function formatProductPrice(price: number) {
  return `${roundPrice(price).toLocaleString("ru-RU")} ₽`;
}

export function buildPriceText(price: number, compareAtPrice?: number) {
  const nextPrice = formatProductPrice(price);

  if (!compareAtPrice || compareAtPrice <= price) {
    return nextPrice;
  }

  return `<s>${formatProductPrice(compareAtPrice)}</s> ${nextPrice}`;
}