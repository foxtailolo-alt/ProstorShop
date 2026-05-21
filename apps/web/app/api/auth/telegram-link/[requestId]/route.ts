import { NextResponse } from "next/server";
import {
  getTelegramLoginRequest,
  markTelegramLoginRequestCompleted,
  markTelegramLoginRequestExpired,
  telegramLoginRequestStatuses,
} from "@prostor/db";
import { setSession } from "../../../../../lib/auth/session";
import { syncTelegramUser } from "../../../../../lib/auth/telegram";

function normalizeRedirect(value?: string | null) {
  if (value && value.startsWith("/")) {
    return value;
  }

  return "/admin";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await context.params;
  const loginRequest = await getTelegramLoginRequest(requestId);

  if (!loginRequest) {
    return NextResponse.json({ error: "Login request not found." }, { status: 404 });
  }

  if (
    loginRequest.expiresAt.getTime() <= Date.now() &&
    loginRequest.status === telegramLoginRequestStatuses.pending
  ) {
    await markTelegramLoginRequestExpired(loginRequest.id);

    return NextResponse.json({
      status: telegramLoginRequestStatuses.expired,
      expiresAt: loginRequest.expiresAt.toISOString(),
    });
  }

  if (
    loginRequest.status !== telegramLoginRequestStatuses.confirmed &&
    loginRequest.status !== telegramLoginRequestStatuses.completed
  ) {
    return NextResponse.json({
      status: loginRequest.status,
      expiresAt: loginRequest.expiresAt.toISOString(),
    });
  }

  if (!loginRequest.telegramId || !loginRequest.firstName || !loginRequest.authDate) {
    return NextResponse.json(
      { error: "Telegram login request is missing confirmed user data." },
      { status: 400 },
    );
  }

  const sessionUser = await syncTelegramUser({
    id: Number(loginRequest.telegramId),
    first_name: loginRequest.firstName,
    last_name: loginRequest.lastName ?? undefined,
    username: loginRequest.telegramUsername ?? undefined,
    auth_date: loginRequest.authDate,
    hash: "telegram-login-request",
  });

  await setSession(sessionUser);

  if (loginRequest.status !== telegramLoginRequestStatuses.completed) {
    await markTelegramLoginRequestCompleted(loginRequest.id);
  }

  const redirectTo = sessionUser.roles.some((role) => role !== "customer")
    ? normalizeRedirect(loginRequest.redirectTo)
    : "/";

  return NextResponse.json({
    status: "authenticated",
    redirectTo,
  });
}