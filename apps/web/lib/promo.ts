import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@prostor/db";

const PROMO_COOKIE_NAME = "prostor_promo";
const PROMO_DURATION_MS = 1000 * 60 * 60 * 24 * 14;
const REFERRAL_REWARD_DESCRIPTION = "Стекло + чехол в подарок";
const REFERRAL_OWNER_CASHBACK_PERCENT = 1;

type DecimalLike = { toString(): string } | number;

export type PromoCodeSummary = {
  id: string;
  code: string;
  type: string;
  rewardDescription: string | null;
  ownerCashbackPercent: number;
  ownerUserId: string | null;
};

function getPromoSecret() {
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
  return createHmac("sha256", getPromoSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encodePromoCode(code: string) {
  const payload = toBase64Url(JSON.stringify({ code, expiresAt: Date.now() + PROMO_DURATION_MS }));
  return `${payload}.${sign(payload)}`;
}

function decodePromoCode(value?: string) {
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  const parsed = JSON.parse(fromBase64Url(payload)) as { code?: string; expiresAt?: number };

  if (!parsed.code || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
    return null;
  }

  return normalizePromoCode(parsed.code);
}

export function normalizePromoCode(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9_-]{3,64}$/.test(normalized) ? normalized : "";
}

export async function getAppliedPromoCode() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return decodePromoCode(cookieStore.get(PROMO_COOKIE_NAME)?.value);
}

export async function setAppliedPromoCode(code: string) {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const normalizedCode = normalizePromoCode(code);

  if (!normalizedCode) {
    throw new Error("Promo code is invalid.");
  }

  cookieStore.set(PROMO_COOKIE_NAME, encodePromoCode(normalizedCode), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + PROMO_DURATION_MS),
  });
}

export async function clearAppliedPromoCode() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set(PROMO_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

function toPromoSummary(record: {
  id: string;
  code: string;
  type: string;
  rewardDescription: string | null;
  ownerCashbackPercent: DecimalLike | null;
  ownerUserId: string | null;
}) {
  return {
    id: record.id,
    code: record.code,
    type: record.type,
    rewardDescription: record.rewardDescription,
    ownerCashbackPercent: Number(record.ownerCashbackPercent ?? 0),
    ownerUserId: record.ownerUserId,
  } satisfies PromoCodeSummary;
}

export async function getPromoCodeSummary(code: string, userId?: string | null) {
  const normalizedCode = normalizePromoCode(code);

  if (!normalizedCode) {
    throw new Error("Промокод указан в неверном формате.");
  }

  const promoCode = await prisma.promoCode.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      type: true,
      rewardDescription: true,
      ownerCashbackPercent: true,
      ownerUserId: true,
      isActive: true,
      usageLimit: true,
      usageCount: true,
    },
  });

  if (!promoCode || !promoCode.isActive) {
    throw new Error("Промокод не найден или отключён.");
  }

  if (promoCode.usageLimit !== null && promoCode.usageCount >= promoCode.usageLimit) {
    throw new Error("Лимит применений этого промокода уже исчерпан.");
  }

  if (userId && promoCode.ownerUserId === userId) {
    throw new Error("Нельзя применить собственный промокод.");
  }

  if (userId && promoCode.type === "referral") {
    const existingOrder = await prisma.order.findFirst({
      where: {
        userId,
        appliedPromoCodeId: promoCode.id,
      },
      select: { id: true },
    });

    if (existingOrder) {
      throw new Error("Реферальный промокод можно использовать только один раз.");
    }
  }

  return toPromoSummary(promoCode);
}

export async function getUserReferralPromoCode(userId: string) {
  const promoCode = await prisma.promoCode.findFirst({
    where: {
      ownerUserId: userId,
      type: "referral",
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      type: true,
      rewardDescription: true,
      ownerCashbackPercent: true,
      ownerUserId: true,
    },
  });

  return promoCode ? toPromoSummary(promoCode) : null;
}

export async function ensureReferralPromoCodeForUser(input: {
  userId: string;
  telegramId?: string | null;
  username?: string | null;
}) {
  const existing = await getUserReferralPromoCode(input.userId);

  if (existing) {
    return existing;
  }

  const idSuffix = input.telegramId?.slice(-6) ?? input.userId.slice(-6);
  const basePrefix = normalizePromoCode(
    input.username ? `${input.username}-${idSuffix.slice(-4)}` : `USER-${idSuffix}`,
  ) || `USER-${idSuffix}`;
  let candidate = basePrefix;
  let suffix = 1;

  for (;;) {
    const conflict = await prisma.promoCode.findUnique({
      where: { code: candidate },
      select: { id: true },
    });

    if (!conflict) {
      const created = await prisma.promoCode.create({
        data: {
          code: candidate,
          type: "referral",
          ownerUserId: input.userId,
          rewardDescription: REFERRAL_REWARD_DESCRIPTION,
          ownerCashbackPercent: REFERRAL_OWNER_CASHBACK_PERCENT,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          type: true,
          rewardDescription: true,
          ownerCashbackPercent: true,
          ownerUserId: true,
        },
      });

      return toPromoSummary(created);
    }

    suffix += 1;
    candidate = `${basePrefix}-${suffix}`;
  }
}
