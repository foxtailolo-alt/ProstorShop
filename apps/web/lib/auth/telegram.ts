import { createHash, createHmac } from "node:crypto";
import { adminRoles } from "@prostor/core";
import { prisma } from "@prostor/db";
import { z } from "zod";
import { ensureReferralPromoCodeForUser } from "../promo";
import type { SessionRole, SessionUser, TelegramAuthInput, TelegramMiniAppAuthInput } from "./types";

function isSessionRole(value: string): value is SessionRole {
  return value === "customer" || adminRoles.includes(value as (typeof adminRoles)[number]);
}

const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

const telegramMiniAppUserSchema = telegramAuthSchema.omit({
  auth_date: true,
  hash: true,
});

const telegramMiniAppAuthSchema = z.object({
  initData: z.string().min(1),
});

const TELEGRAM_AUTH_MAX_AGE_SECONDS = 60 * 10;

function getTelegramBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  return token;
}

function getTelegramMiniAppSecret() {
  return createHmac("sha256", "WebAppData").update(getTelegramBotToken()).digest();
}

function getBootstrapAdminIds() {
  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getBootstrapRole(telegramId: string): SessionRole | null {
  const adminIds = getBootstrapAdminIds();

  if (!adminIds.includes(telegramId)) {
    return null;
  }

  return "owner";
}

function validateAuthAge(authDate: number) {
  const authAgeSeconds = Math.floor(Date.now() / 1000) - authDate;

  if (authAgeSeconds > TELEGRAM_AUTH_MAX_AGE_SECONDS) {
    throw new Error("Telegram auth data is too old.");
  }
}

function validateTelegramLoginAuth(rawInput: unknown): TelegramAuthInput {
  const input = telegramAuthSchema.parse(rawInput);

  validateAuthAge(input.auth_date);

  const entries = Object.entries(input)
    .filter(([key]) => key !== "hash")
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHash("sha256").update(getTelegramBotToken()).digest();
  const calculatedHash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (calculatedHash !== input.hash) {
    throw new Error("Telegram auth signature is invalid.");
  }

  return input;
}

function validateTelegramMiniAppAuth(rawInput: unknown): TelegramMiniAppAuthInput {
  const { initData } = telegramMiniAppAuthSchema.parse(rawInput);
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = params.get("auth_date");
  const user = params.get("user");

  if (!hash || !authDate || !user) {
    throw new Error("Telegram Mini App auth payload is incomplete.");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const calculatedHash = createHmac("sha256", getTelegramMiniAppSecret())
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) {
    throw new Error("Telegram auth signature is invalid.");
  }

  const parsedUser = telegramMiniAppUserSchema.parse(JSON.parse(user) as unknown);
  const normalizedInput = telegramAuthSchema.parse({
    ...parsedUser,
    auth_date: Number(authDate),
    hash,
  });

  validateAuthAge(normalizedInput.auth_date);

  return {
    ...normalizedInput,
    initData,
  };
}

export function validateTelegramAuth(rawInput: unknown): TelegramAuthInput {
  if (
    typeof rawInput === "object" &&
    rawInput !== null &&
    "initData" in rawInput &&
    typeof rawInput.initData === "string"
  ) {
    return validateTelegramMiniAppAuth(rawInput);
  }

  return validateTelegramLoginAuth(rawInput);
}

async function ensureRole(code: SessionRole) {
  if (code === "customer") {
    return null;
  }

  const roleCode = adminRoles.includes(code) ? code : "manager";

  return prisma.role.upsert({
    where: { code: roleCode },
    update: { name: roleCode },
    create: { code: roleCode, name: roleCode },
  });
}

export async function syncTelegramUser(input: TelegramAuthInput): Promise<SessionUser> {
  const telegramId = String(input.id);
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: {
      firstName: input.first_name,
      lastName: input.last_name,
      telegramUsername: input.username,
    },
    create: {
      telegramId,
      firstName: input.first_name,
      lastName: input.last_name,
      telegramUsername: input.username,
    },
    include: {
      roleAssignments: {
        include: {
          role: true,
        },
      },
    },
  });

  const bootstrapRole = getBootstrapRole(telegramId);

  if (bootstrapRole) {
    const role = await ensureRole(bootstrapRole);

    if (role) {
      await prisma.roleAssignment.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }
  }

  const freshUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      roleAssignments: {
        include: {
          role: true,
        },
      },
    },
  });

  const roles: SessionRole[] = freshUser.roleAssignments
    .map((assignment) => assignment.role.code)
    .filter((role): role is SessionRole => isSessionRole(role));
  const sessionRoles: SessionRole[] = roles.length > 0 ? roles : ["customer"];

  await ensureReferralPromoCodeForUser({
    userId: freshUser.id,
    telegramId,
    username: freshUser.telegramUsername,
  });

  return {
    id: freshUser.id,
    telegramId,
    username: freshUser.telegramUsername,
    firstName: freshUser.firstName,
    lastName: freshUser.lastName,
    phone: freshUser.phone,
    roles: sessionRoles,
  };
}