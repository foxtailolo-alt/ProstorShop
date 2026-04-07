import { NextResponse } from "next/server";
import { setSession } from "../../../../lib/auth/session";
import { syncTelegramUser } from "../../../../lib/auth/telegram";

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeRedirect(value: FormDataEntryValue | null) {
  if (typeof value === "string" && value.startsWith("/")) {
    return value;
  }

  return "/admin";
}

function getAdminIds() {
  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  if (process.env.NODE_ENV === "production" || !isLocalHost(url.hostname)) {
    return NextResponse.json({ error: "Dev login is disabled." }, { status: 403 });
  }

  const formData = await request.formData();
  const telegramId = String(formData.get("telegramId") ?? "").trim();
  const redirectTo = normalizeRedirect(formData.get("redirectTo"));

  if (!getAdminIds().includes(telegramId)) {
    return NextResponse.json({ error: "Telegram ID is not allowed for dev login." }, { status: 403 });
  }

  const sessionUser = await syncTelegramUser({
    id: Number(telegramId),
    first_name: telegramId === getAdminIds()[0] ? "Owner" : "Manager",
    last_name: "Local",
    username: `local_${telegramId}`,
    auth_date: Math.floor(Date.now() / 1000),
    hash: "dev-localhost",
  });

  await setSession(sessionUser);

  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
}