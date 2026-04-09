import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const CART_COOKIE_NAME = "prostor_cart";
const CART_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

export type CartItem = {
  itemKey: string;
  productSlug: string;
  quantity: number;
  variantLabel?: string;
  unitPrice: number;
};

type CartPayload = {
  items: Array<Partial<CartItem>>;
  expiresAt: number;
};

function getCartSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getCartSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeCart(payload: CartPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function decodeCart(value?: string) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  const parsed = JSON.parse(fromBase64Url(encodedPayload)) as CartPayload;

  if (parsed.expiresAt <= Date.now()) {
    return null;
  }

  const items = parsed.items.filter(isCartItemRecord).map(normalizeCartItem).filter(isDefined);

  return {
    items,
    expiresAt: parsed.expiresAt,
  } satisfies CartPayload;
}

export function buildCartItemKey(productSlug: string, variantLabel?: string) {
  const normalizedVariant = normalizeVariantLabel(variantLabel);

  return normalizedVariant ? `${productSlug}::${normalizedVariant}` : productSlug;
}

function normalizeVariantLabel(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeUnitPrice(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isCartItemRecord(value: unknown): value is Partial<CartItem> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCartItem(item: Partial<CartItem>) {
  const quantity = typeof item.quantity === "number" && Number.isInteger(item.quantity) ? item.quantity : null;

  if (!item.productSlug || quantity === null || quantity <= 0) {
    return null;
  }

  const variantLabel = normalizeVariantLabel(item.variantLabel);
  const unitPrice = normalizeUnitPrice(item.unitPrice);

  if (unitPrice === null) {
    return null;
  }

  return {
    itemKey: item.itemKey || buildCartItemKey(item.productSlug, variantLabel),
    productSlug: item.productSlug,
    quantity,
    variantLabel,
    unitPrice,
  } satisfies CartItem;
}

async function writeCart(items: CartItem[]) {
  const cookieStore = await cookies();

  if (items.length === 0) {
    cookieStore.set(CART_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
    return;
  }

  const payload: CartPayload = {
    items,
    expiresAt: Date.now() + CART_DURATION_MS,
  };

  cookieStore.set(CART_COOKIE_NAME, encodeCart(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(payload.expiresAt),
  });
}

export async function getCartItems() {
  const cookieStore = await cookies();
  return decodeCart(cookieStore.get(CART_COOKIE_NAME)?.value)?.items ?? [];
}

export async function addCartItem(input: {
  productSlug: string;
  quantity?: number;
  variantLabel?: string;
  unitPrice: number;
}) {
  const items = await getCartItems();
  const quantity = input.quantity ?? 1;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Cart quantity is invalid.");
  }

  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
    throw new Error("Cart unit price is invalid.");
  }

  const itemKey = buildCartItemKey(input.productSlug, input.variantLabel);
  const existingItem = items.find((item) => item.itemKey === itemKey);

  const nextItems = existingItem
    ? items.map((item) =>
        item.itemKey === itemKey
          ? { ...item, quantity: item.quantity + quantity }
          : item,
      )
    : [
        ...items,
        {
          itemKey,
          productSlug: input.productSlug,
          quantity,
          variantLabel: normalizeVariantLabel(input.variantLabel),
          unitPrice: input.unitPrice,
        },
      ];

  await writeCart(nextItems);
}

export async function updateCartItem(itemKey: string, quantity: number) {
  const items = await getCartItems();
  const nextItems = quantity <= 0
    ? items.filter((item) => item.itemKey !== itemKey)
    : items.map((item) =>
        item.itemKey === itemKey ? { ...item, quantity } : item,
      );

  await writeCart(nextItems);
}

export async function removeCartItem(itemKey: string) {
  const items = await getCartItems();
  await writeCart(items.filter((item) => item.itemKey !== itemKey));
}

export async function clearCart() {
  await writeCart([]);
}