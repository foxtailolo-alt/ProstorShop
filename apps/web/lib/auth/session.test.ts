import { describe, expect, it, vi, beforeAll } from "vitest";

// Set env before importing
beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = "test-secret-key-for-vitest-32ch";
});

describe("Session encode/decode", () => {
  it("encodes and decodes a valid session", async () => {
    // Import after env is set
    const { encodeSession, decodeSession } = await import("./session");

    const payload = {
      user: {
        id: "user-1",
        telegramId: "123456",
        username: "testuser",
        firstName: "Test",
        lastName: null,
        roles: ["owner" as const],
      },
      expiresAt: Date.now() + 1000 * 60 * 60,
    };

    const encoded = encodeSession(payload);
    expect(encoded).toContain(".");

    const decoded = decodeSession(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.user.id).toBe("user-1");
    expect(decoded!.user.roles).toContain("owner");
  });

  it("returns null for empty value", async () => {
    const { decodeSession } = await import("./session");
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("")).toBeNull();
  });

  it("returns null for tampered token", async () => {
    const { encodeSession, decodeSession } = await import("./session");

    const payload = {
      user: {
        id: "user-1",
        telegramId: "123456",
        username: null,
        firstName: null,
        lastName: null,
        roles: ["viewer" as const],
      },
      expiresAt: Date.now() + 1000 * 60 * 60,
    };

    const encoded = encodeSession(payload);
    const tampered = encoded.slice(0, -5) + "XXXXX";
    expect(decodeSession(tampered)).toBeNull();
  });

  it("returns null for expired token", async () => {
    const { encodeSession, decodeSession } = await import("./session");

    const payload = {
      user: {
        id: "user-1",
        telegramId: "123456",
        username: null,
        firstName: null,
        lastName: null,
        roles: ["owner" as const],
      },
      expiresAt: Date.now() - 1000,
    };

    const encoded = encodeSession(payload);
    expect(decodeSession(encoded)).toBeNull();
  });
});

describe("isAdminSession", () => {
  it("returns true for admin roles", async () => {
    const { isAdminSession } = await import("./session");

    expect(
      isAdminSession({
        user: { id: "1", telegramId: "1", username: null, firstName: null, lastName: null, roles: ["owner"] },
        expiresAt: Date.now() + 60000,
      }),
    ).toBe(true);
  });

  it("returns false for customer-only", async () => {
    const { isAdminSession } = await import("./session");

    expect(
      isAdminSession({
        user: { id: "1", telegramId: "1", username: null, firstName: null, lastName: null, roles: ["customer"] },
        expiresAt: Date.now() + 60000,
      }),
    ).toBe(false);
  });

  it("returns false for null", async () => {
    const { isAdminSession } = await import("./session");
    expect(isAdminSession(null)).toBe(false);
  });
});

describe("checkPermission", () => {
  it("checks permission based on role", async () => {
    const { checkPermission } = await import("./session");

    const session = {
      user: { id: "1", telegramId: "1", username: null, firstName: null, lastName: null, roles: ["editor" as const] },
      expiresAt: Date.now() + 60000,
    };

    expect(checkPermission(session, "products", "write")).toBe(true);
    expect(checkPermission(session, "settings", "write")).toBe(false);
  });
});
