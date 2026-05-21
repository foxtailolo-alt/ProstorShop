import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@prostor/db", () => ({
  prisma: {},
}));

vi.mock("../promo", () => ({
  ensureReferralPromoCodeForUser: vi.fn(),
}));

function createLegacyHash(payload: Record<string, string | number | undefined>, token: string) {
  const dataCheckString = Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();

  return createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

function createMiniAppInitData(user: Record<string, string | number>, authDate: number, token: string) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify(user),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  params.set("hash", hash);

  return params.toString();
}

describe("validateTelegramAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TELEGRAM_BOT_TOKEN = "test-telegram-bot-token";
  });

  it("accepts Telegram Mini App initData", async () => {
    const { validateTelegramAuth } = await import("./telegram");
    const authDate = Math.floor(Date.now() / 1000);
    const initData = createMiniAppInitData(
      {
        id: 777000,
        first_name: "Mini",
        last_name: "App",
        username: "miniapp_user",
        photo_url: "https://t.me/i/userpic/320/example.jpg",
      },
      authDate,
      process.env.TELEGRAM_BOT_TOKEN!,
    );

    expect(validateTelegramAuth({ initData })).toEqual({
      id: 777000,
      first_name: "Mini",
      last_name: "App",
      username: "miniapp_user",
      photo_url: "https://t.me/i/userpic/320/example.jpg",
      auth_date: authDate,
      hash: expect.any(String),
      initData,
    });
  });

  it("accepts legacy Telegram login payload", async () => {
    const { validateTelegramAuth } = await import("./telegram");
    const authDate = Math.floor(Date.now() / 1000);
    const payload = {
      id: 777001,
      first_name: "Legacy",
      last_name: "Login",
      username: "legacy_login",
      photo_url: "https://t.me/i/userpic/320/legacy.jpg",
      auth_date: authDate,
    };
    const hash = createLegacyHash(payload, process.env.TELEGRAM_BOT_TOKEN!);

    expect(validateTelegramAuth({ ...payload, hash })).toEqual({
      ...payload,
      hash,
    });
  });
});