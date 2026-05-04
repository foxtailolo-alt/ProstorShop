"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { getAttributionSnapshot } from "../../../lib/attribution";
import { getSession } from "../../../lib/auth/session";

async function getActiveServiceVariant(variantId: string) {
  try {
    return await prisma.serviceCatalogVariant.findFirst({
      where: {
        id: variantId,
        isActive: true,
        model: {
          isActive: true,
          service: {
            isActive: true,
          },
        },
      },
      include: {
        model: {
          include: {
            service: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export async function submitServiceRequestAction(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const repairType = String(formData.get("repairType") ?? "").trim();
  const serviceSlug = String(formData.get("serviceSlug") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const variantName = String(formData.get("variantName") ?? "").trim();
  const variantDescription = String(formData.get("variantDescription") ?? "").trim();
  const partPrice = Number(formData.get("partPrice") ?? 0);
  const laborPrice = Number(formData.get("laborPrice") ?? 0);
  const currency = String(formData.get("currency") ?? "RUB").trim() || "RUB";
  const quote = Number(formData.get("quote") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!customerName || !phone || !brand || !model || !repairType || !Number.isFinite(quote) || quote < 0) {
    throw new Error("Service request form is incomplete.");
  }

  const [session, attribution, activeVariant] = await Promise.all([
    getSession(),
    getAttributionSnapshot(),
    variantId ? getActiveServiceVariant(variantId) : Promise.resolve(null),
  ]);

  const resolvedBrand = activeVariant?.model.brand ?? brand;
  const resolvedModel = activeVariant?.model.name ?? model;
  const resolvedRepairType = activeVariant?.model.service.name ?? repairType;
  const resolvedServiceSlug = activeVariant?.model.service.slug ?? (serviceSlug || null);
  const resolvedVariantId = activeVariant?.id ?? (variantId || null);
  const resolvedVariantName = activeVariant?.name ?? (variantName || null);
  const resolvedVariantDescription = activeVariant?.description ?? (variantDescription || null);
  const resolvedPartPrice = activeVariant ? Number(activeVariant.partPrice) : partPrice;
  const resolvedLaborPrice = activeVariant ? Number(activeVariant.laborPrice) : laborPrice;
  const resolvedCurrency = activeVariant?.currency ?? currency;
  const resolvedQuote = activeVariant ? Number(activeVariant.totalPrice) : quote;

  if (!resolvedVariantName || !Number.isFinite(resolvedQuote) || resolvedQuote < 0) {
    throw new Error("Выберите вариант ремонта перед отправкой заявки.");
  }

  const request = await prisma.serviceRequest.create({
    data: {
      userId: session?.user.id ?? null,
      customerName,
      phone,
      brand: resolvedBrand,
      model: resolvedModel,
      repairType: resolvedRepairType,
      serviceSlug: resolvedServiceSlug,
      variantId: resolvedVariantId,
      variantName: resolvedVariantName,
      variantDescription: resolvedVariantDescription,
      partPrice: resolvedPartPrice,
      laborPrice: resolvedLaborPrice,
      currency: resolvedCurrency,
      quote: resolvedQuote,
      note: note || null,
      attribution: attribution ?? undefined,
    },
  });

  revalidatePath("/service");
  revalidatePath("/admin/service-pricing");
  revalidatePath("/admin");
  redirect(`/service?success=1&requestId=${request.id}`);
}