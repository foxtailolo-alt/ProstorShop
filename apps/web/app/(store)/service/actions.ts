"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { getAttributionSnapshot } from "../../../lib/attribution";
import { getSession } from "../../../lib/auth/session";

export async function submitServiceRequestAction(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const repairType = String(formData.get("repairType") ?? "").trim();
  const quote = Number(formData.get("quote") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!customerName || !phone || !brand || !model || !repairType || !Number.isFinite(quote) || quote < 0) {
    throw new Error("Service request form is incomplete.");
  }

  const [session, attribution] = await Promise.all([getSession(), getAttributionSnapshot()]);

  const request = await prisma.serviceRequest.create({
    data: {
      userId: session?.user.id ?? null,
      customerName,
      phone,
      brand,
      model,
      repairType,
      quote,
      note: note || null,
      attribution: attribution ?? undefined,
    },
  });

  revalidatePath("/service");
  revalidatePath("/admin/service-pricing");
  revalidatePath("/admin");
  redirect(`/service?success=1&requestId=${request.id}`);
}