"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { buildCurrentDeviceRankLabel, getCategoryCodeFamily, normalizeText } from "../../../lib/upgrade-suggestions";
import { buildUsedDeviceWaitlistModelRank } from "../../../lib/used-device-waitlist";
import { getSession } from "../../../lib/auth/session";

function normalizeNoPreference(value: string | null) {
  if (!value) {
    return null;
  }

  return normalizeText(value) === "не важно" ? null : value;
}

function parseAnswersJson(value: string) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter(([, item]) => typeof item === "string"));
    }
  } catch {
    return null;
  }

  return null;
}

export async function createUsedDeviceWaitlistEntryAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    throw new Error("Авторизуйтесь, чтобы добавить устройство в список ожидания.");
  }

  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const categoryCode = String(formData.get("categoryCode") ?? "").trim();
  const deviceModelCode = String(formData.get("deviceModelCode") ?? "").trim() || null;
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const color = normalizeNoPreference(String(formData.get("color") ?? "").trim() || null);
  const displaySize = String(formData.get("displaySize") ?? "").trim() || null;
  const connectivity = normalizeNoPreference(String(formData.get("connectivity") ?? "").trim() || null);
  const answersJsonValue = String(formData.get("answersJson") ?? "").trim();

  if (!brand || !model || !categoryCode) {
    throw new Error("Форма списка ожидания заполнена не полностью.");
  }

  const family = getCategoryCodeFamily(categoryCode);
  const normalizedModel = normalizeText(
    family ? buildCurrentDeviceRankLabel(family, { model }) : model,
  );

  await prisma.usedDeviceWaitlistEntry.create({
    data: {
      userId: session.user.id,
      categoryCode,
      brand,
      model,
      deviceModelCode,
      normalizedModel,
      modelRank: buildUsedDeviceWaitlistModelRank({
        categoryCode,
        brand,
        model,
        deviceModelCode,
        storage,
        color,
        displaySize,
        connectivity,
      }),
      storage,
      color,
      displaySize,
      connectivity,
      answersJson: parseAnswersJson(answersJsonValue) ?? undefined,
    },
  });

  revalidatePath("/profile");
  redirect("/profile?waitlistAdded=1");
}

export async function deleteUsedDeviceWaitlistEntryAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    throw new Error("Авторизуйтесь, чтобы управлять списком ожидания.");
  }

  const entryId = String(formData.get("entryId") ?? "").trim();
  if (!entryId) {
    throw new Error("Не удалось определить запись списка ожидания.");
  }

  await prisma.usedDeviceWaitlistEntry.deleteMany({
    where: {
      id: entryId,
      userId: session.user.id,
    },
  });

  revalidatePath("/profile");
}

export async function openProfileNotificationAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    throw new Error("Авторизуйтесь, чтобы открыть уведомление.");
  }

  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const actionUrl = String(formData.get("actionUrl") ?? "/profile").trim() || "/profile";

  if (!notificationId) {
    throw new Error("Не удалось определить уведомление.");
  }

  await prisma.profileNotification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: {
      isViewed: true,
      viewedAt: new Date(),
    },
  });

  revalidatePath("/profile");
  redirect(actionUrl as never);
}