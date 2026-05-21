import { NextResponse } from "next/server";
import { buildTelegramBotStartUrl, buildTelegramLoginStartParam } from "@prostor/core";
import { createTelegramLoginRequest } from "@prostor/db";

type RequestBody = {
  redirectTo?: string;
};

function normalizeRedirect(value?: string) {
  if (value && value.startsWith("/")) {
    return value;
  }

  return "/admin";
}

function getTelegramBotUsername() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();

  if (!botUsername) {
    throw new Error("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not configured.");
  }

  return botUsername;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const loginRequest = await createTelegramLoginRequest(normalizeRedirect(body.redirectTo));
    const openUrl = buildTelegramBotStartUrl({
      botUsername: getTelegramBotUsername(),
      startParam: buildTelegramLoginStartParam(loginRequest.id),
    });

    return NextResponse.json({
      requestId: loginRequest.id,
      openUrl,
      expiresAt: loginRequest.expiresAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create Telegram login request.",
      },
      { status: 400 },
    );
  }
}