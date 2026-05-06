"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { createUniquePromoCode, normalizePromoCode } from "../../../../lib/promo";

const SUPPORTED_SCOPES = new Set(["cart", "trade-in", "any"]);
const SUPPORTED_DISCOUNT_KINDS = new Set(["reward", "flat", "percent"]);

function parseDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseIntegerInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDecimalInput(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function upsertPromoCodeAction(formData: FormData) {
  await requirePermission("promo-codes", "write");

  const id = String(formData.get("id") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const scope = String(formData.get("scope") ?? "cart").trim();
  const discountKind = String(formData.get("discountKind") ?? "reward").trim();
  const discountValue = parseDecimalInput(String(formData.get("discountValue") ?? ""));
  const rewardDescription = String(formData.get("rewardDescription") ?? "").trim() || null;
  const usageLimit = parseIntegerInput(String(formData.get("usageLimit") ?? ""));
  const perUserLimit = parseIntegerInput(String(formData.get("perUserLimit") ?? ""));
  const startsAt = parseDateInput(String(formData.get("startsAt") ?? ""));
  const endsAt = parseDateInput(String(formData.get("endsAt") ?? ""));
  const isActive = formData.get("isActive") === "on";
  const autoCode = formData.get("autoCode") === "on";

  if (!SUPPORTED_SCOPES.has(scope)) {
    throw new Error("Недопустимая область применения промокода.");
  }

  if (!SUPPORTED_DISCOUNT_KINDS.has(discountKind)) {
    throw new Error("Недопустимый тип скидки.");
  }

  if ((discountKind === "flat" || discountKind === "percent") && (!discountValue || discountValue <= 0)) {
    throw new Error("Укажите положительный размер скидки.");
  }

  if (discountKind === "percent" && discountValue && discountValue > 100) {
    throw new Error("Процентная скидка не может превышать 100%.");
  }

  let code = normalizePromoCode(codeRaw);
  if (!id) {
    if (autoCode || !code) {
      code = await createUniquePromoCode("PROSTOR", 6);
    } else {
      const conflict = await prisma.promoCode.findUnique({ where: { code } });
      if (conflict) {
        throw new Error("Промокод с таким кодом уже существует.");
      }
    }
  } else if (!code) {
    throw new Error("Код промокода не может быть пустым.");
  }

  const data = {
    code,
    scope,
    discountKind,
    discountValue: discountValue ?? null,
    rewardDescription,
    usageLimit,
    perUserLimit,
    startsAt,
    endsAt,
    isActive,
  };

  let saved;
  if (id) {
    saved = await prisma.promoCode.update({ where: { id }, data });
  } else {
    saved = await prisma.promoCode.create({
      data: {
        ...data,
        type: "custom",
      },
    });
  }

  await logAdminActivity({
    entityType: "promo-code",
    entityId: saved.id,
    action: id ? "promo.updated" : "promo.created",
    summary: `Промокод ${saved.code} ${id ? "обновлён" : "создан"}.`,
    metadata: { scope, discountKind, discountValue, isActive },
  });

  revalidatePath("/admin/promo-codes");
}

export async function togglePromoCodeAction(formData: FormData) {
  await requirePermission("promo-codes", "write");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Не указан промокод.");

  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new Error("Промокод не найден.");

  const updated = await prisma.promoCode.update({
    where: { id },
    data: { isActive: !promo.isActive },
  });

  await logAdminActivity({
    entityType: "promo-code",
    entityId: id,
    action: updated.isActive ? "promo.activated" : "promo.deactivated",
    summary: `Промокод ${updated.code} ${updated.isActive ? "активирован" : "отключён"}.`,
  });

  revalidatePath("/admin/promo-codes");
}

export async function deletePromoCodeAction(formData: FormData) {
  await requirePermission("promo-codes", "delete");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Не указан промокод.");

  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new Error("Промокод не найден.");

  if (promo.type === "referral" || promo.type === "trade-in-bonus") {
    throw new Error("Системные промокоды нельзя удалять. Отключите его вместо удаления.");
  }

  await prisma.promoCode.delete({ where: { id } }).catch((err: unknown) => {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2003") {
      throw new Error("Промокод уже использовался в заказах. Отключите его вместо удаления.");
    }
    throw err;
  });

  await logAdminActivity({
    entityType: "promo-code",
    entityId: id,
    action: "promo.deleted",
    summary: `Промокод ${promo.code} удалён.`,
  });

  revalidatePath("/admin/promo-codes");
}
