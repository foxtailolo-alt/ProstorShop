import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const CART_COOKIE_NAME = "prostor_cart";
const CART_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

export type CartItem = {
  productSlug: string;
  quantity: number;
};

type CartPayload = {
  items: CartItem[];
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

  const items = parsed.items.filter(
    (item) => item.productSlug && Number.isInteger(item.quantity) && item.quantity > 0,
  );

  return {
    items,
    expiresAt: parsed.expiresAt,
  } satisfies CartPayload;
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

export async function addCartItem(productSlug: string, quantity = 1) {
  const items = await getCartItems();
  const existingItem = items.find((item) => item.productSlug === productSlug);

  const nextItems = existingItem
    ? items.map((item) =>
        item.productSlug === productSlug
          ? { ...item, quantity: item.quantity + quantity }
          : item,
      )
    : [...items, { productSlug, quantity }];

  await writeCart(nextItems);
}

export async function updateCartItem(productSlug: string, quantity: number) {
  const items = await getCartItems();
  const nextItems = quantity <= 0
    ? items.filter((item) => item.productSlug !== productSlug)
    : items.map((item) =>
        item.productSlug === productSlug ? { ...item, quantity } : item,
      );

  await writeCart(nextItems);
}

export async function removeCartItem(productSlug: string) {
  const items = await getCartItems();
  await writeCart(items.filter((item) => item.productSlug !== productSlug));
}

export async function clearCart() {
  await writeCart([]);
}