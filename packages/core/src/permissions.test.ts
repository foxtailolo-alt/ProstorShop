import { describe, expect, it } from "vitest";
import {
  hasPermission,
  type AdminRole,
} from "../src/index";

describe("hasPermission", () => {
  it("owner has full access", () => {
    expect(hasPermission("owner", "settings", "write")).toBe(true);
    expect(hasPermission("owner", "products", "delete")).toBe(true);
    expect(hasPermission("owner", "marketing", "read")).toBe(true);
  });

  it("viewer can only read", () => {
    expect(hasPermission("viewer", "products", "read")).toBe(true);
    expect(hasPermission("viewer", "products", "write")).toBe(false);
    expect(hasPermission("viewer", "products", "delete")).toBe(false);
  });

  it("editor can write products but not settings", () => {
    expect(hasPermission("editor", "products", "write")).toBe(true);
    expect(hasPermission("editor", "settings", "write")).toBe(false);
    expect(hasPermission("editor", "settings", "read")).toBe(false);
  });

  it("manager can write orders but not settings", () => {
    expect(hasPermission("manager", "orders", "write")).toBe(true);
    expect(hasPermission("manager", "clients", "write")).toBe(true);
    expect(hasPermission("manager", "settings", "write")).toBe(false);
    expect(hasPermission("manager", "settings", "read")).toBe(true);
  });

  it("manager can delete products and banners", () => {
    expect(hasPermission("manager", "products", "delete")).toBe(true);
    expect(hasPermission("manager", "banners", "delete")).toBe(true);
    expect(hasPermission("manager", "orders", "delete")).toBe(false);
  });

  it("viewer can read clients but not edit them", () => {
    expect(hasPermission("viewer", "clients", "read")).toBe(true);
    expect(hasPermission("viewer", "clients", "write")).toBe(false);
  });
});
