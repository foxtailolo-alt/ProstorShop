import { NextResponse } from "next/server";
import { setSession } from "../../../../lib/auth/session";
import { syncTelegramUser, validateTelegramAuth } from "../../../../lib/auth/telegram";

type RequestBody = {
  redirectTo?: string;
};

function normalizeRedirect(value?: string) {
  if (value && value.startsWith("/")) {
    return value;
  }

  return "/admin";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const telegramUser = validateTelegramAuth(body);
    const sessionUser = await syncTelegramUser(telegramUser);

    await setSession(sessionUser);

    const redirectTo = sessionUser.roles.some((role) => role !== "customer")
      ? normalizeRedirect(body.redirectTo)
      : "/";

    return NextResponse.json({ redirectTo });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Telegram auth failed.",
      },
      { status: 400 },
    );
  }
}