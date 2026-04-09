import { NextResponse } from "next/server";
import { setSession } from "../../../../lib/auth/session";
import { syncTelegramUser } from "../../../../lib/auth/telegram";

function getBootstrapSecret() {
  return process.env.AUTH_BOOTSTRAP_SECRET?.trim() ?? "";
}

function getOwnerTelegramId() {
  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];
}

function normalizeRedirect(value: FormDataEntryValue | null) {
  if (typeof value === "string" && value.startsWith("/")) {
    return value;
  }

  return "/admin";
}

function buildErrorUrl(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("bootstrapError", message);
  return url;
}

export async function POST(request: Request) {
  const expectedSecret = getBootstrapSecret();
  const ownerTelegramId = getOwnerTelegramId();

  if (!expectedSecret || !ownerTelegramId) {
    return NextResponse.redirect(buildErrorUrl(request, "Резервный вход отключён."), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const secret = String(formData.get("secret") ?? "").trim();
  const redirectTo = normalizeRedirect(formData.get("redirectTo"));

  if (secret !== expectedSecret) {
    return NextResponse.redirect(buildErrorUrl(request, "Неверный секрет входа."), {
      status: 303,
    });
  }

  const sessionUser = await syncTelegramUser({
    id: Number(ownerTelegramId),
    first_name: "Owner",
    last_name: "Bootstrap",
    username: `bootstrap_${ownerTelegramId}`,
    auth_date: Math.floor(Date.now() / 1000),
    hash: "bootstrap-login",
  });

  await setSession(sessionUser);

  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
}