import { prisma } from "./index";

export const TELEGRAM_LOGIN_REQUEST_TTL_MS = 1000 * 60 * 5;

export const telegramLoginRequestStatuses = {
  pending: "pending",
  confirmed: "confirmed",
  completed: "completed",
  expired: "expired",
} as const;

export type TelegramLoginRequestStatus =
  (typeof telegramLoginRequestStatuses)[keyof typeof telegramLoginRequestStatuses];

export async function createTelegramLoginRequest(redirectTo?: string | null) {
  return prisma.telegramLoginRequest.create({
    data: {
      redirectTo: redirectTo ?? null,
      expiresAt: new Date(Date.now() + TELEGRAM_LOGIN_REQUEST_TTL_MS),
    },
  });
}

export async function getTelegramLoginRequest(requestId: string) {
  return prisma.telegramLoginRequest.findUnique({
    where: { id: requestId },
  });
}

export async function markTelegramLoginRequestExpired(requestId: string) {
  return prisma.telegramLoginRequest.update({
    where: { id: requestId },
    data: {
      status: telegramLoginRequestStatuses.expired,
    },
  });
}

export async function markTelegramLoginRequestCompleted(requestId: string) {
  return prisma.telegramLoginRequest.update({
    where: { id: requestId },
    data: {
      status: telegramLoginRequestStatuses.completed,
      completedAt: new Date(),
    },
  });
}

export async function confirmTelegramLoginRequest(input: {
  requestId: string;
  telegramId: string;
  telegramUsername?: string;
  firstName: string;
  lastName?: string;
  authDate: number;
}) {
  const request = await getTelegramLoginRequest(input.requestId);

  if (!request) {
    return { request: null, outcome: "missing" as const };
  }

  if (request.expiresAt.getTime() <= Date.now()) {
    const expiredRequest = request.status === telegramLoginRequestStatuses.expired
      ? request
      : await markTelegramLoginRequestExpired(request.id);

    return { request: expiredRequest, outcome: "expired" as const };
  }

  if (request.status === telegramLoginRequestStatuses.completed) {
    return { request, outcome: "completed" as const };
  }

  if (request.status === telegramLoginRequestStatuses.confirmed) {
    return { request, outcome: "confirmed" as const };
  }

  const confirmedRequest = await prisma.telegramLoginRequest.update({
    where: { id: request.id },
    data: {
      status: telegramLoginRequestStatuses.confirmed,
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername,
      firstName: input.firstName,
      lastName: input.lastName,
      authDate: input.authDate,
      confirmedAt: new Date(),
    },
  });

  return { request: confirmedRequest, outcome: "confirmed-now" as const };
}