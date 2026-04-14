import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@prostor/db";
import { setSession } from "../../../../lib/auth/session";
import type { SessionRole, SessionUser } from "../../../../lib/auth/types";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

function validatePhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+?\d{10,15}$/.test(normalized);
}

function buildSessionUser(user: {
  id: string;
  telegramId: string | null;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  roleAssignments: { role: { code: string } }[];
}): SessionUser {
  const roles = user.roleAssignments
    .map((a) => a.role.code)
    .filter((code): code is SessionRole => ["owner", "manager", "editor", "viewer", "customer"].includes(code));

  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.telegramUsername,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    roles: roles.length > 0 ? roles : ["customer"],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "register") {
      return handleRegister(body);
    }

    if (action === "login") {
      return handleLogin(body);
    }

    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка авторизации." },
      { status: 400 },
    );
  }
}

async function handleRegister(body: Record<string, unknown>) {
  const firstName = String(body.firstName ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  const password = String(body.password ?? "");
  const redirectTo = String(body.redirectTo ?? "/");

  if (!firstName) {
    return NextResponse.json({ error: "Укажите имя." }, { status: 400 });
  }

  if (!validatePhone(phone)) {
    return NextResponse.json({ error: "Неверный формат телефона." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль должен быть не менее 6 символов." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { phone } });

  if (existing) {
    return NextResponse.json({ error: "Пользователь с таким телефоном уже зарегистрирован." }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      firstName,
      phone,
      passwordHash: hashPassword(password),
    },
    include: { roleAssignments: { include: { role: true } } },
  });

  const sessionUser = buildSessionUser(user);
  await setSession(sessionUser);

  return NextResponse.json({ redirectTo });
}

async function handleLogin(body: Record<string, unknown>) {
  const phone = normalizePhone(String(body.phone ?? ""));
  const password = String(body.password ?? "");
  const redirectTo = String(body.redirectTo ?? "/");

  if (!validatePhone(phone)) {
    return NextResponse.json({ error: "Неверный формат телефона." }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Введите пароль." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { roleAssignments: { include: { role: true } } },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Неверный телефон или пароль." }, { status: 400 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Неверный телефон или пароль." }, { status: 400 });
  }

  const sessionUser = buildSessionUser(user);
  await setSession(sessionUser);

  const isAdmin = sessionUser.roles.some((role) => role !== "customer");

  return NextResponse.json({ redirectTo: isAdmin ? redirectTo : "/" });
}
