import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { hasPermission, type AdminAction, type AdminResource } from "@prostor/core";
import type { SessionUser } from "./types";

const SESSION_COOKIE_NAME = "prostor_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export type SessionPayload = {
  user: SessionUser;
  expiresAt: number;
};

export function encodeSession(payload: SessionPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function decodeSession(value?: string) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  const parsed = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;

  if (parsed.expiresAt <= Date.now()) {
    return null;
  }

  return parsed;
}

export async function getSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    user,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(payload.expiresAt),
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export function isAdminSession(session: SessionPayload | null) {
  if (!session) {
    return false;
  }

  return session.user.roles.some((role) => role !== "customer");
}

export function checkPermission(
  session: SessionPayload | null,
  resource: AdminResource,
  action: AdminAction,
): boolean {
  if (!session) return false;
  return session.user.roles.some(
    (role) => role !== "customer" && hasPermission(role, resource, action),
  );
}

export async function requirePermission(resource: AdminResource, action: AdminAction): Promise<SessionPayload> {
  const session = await getSession();
  if (!checkPermission(session, resource, action)) {
    throw new Error("Недостаточно прав для выполнения этого действия.");
  }
  return session!;
}