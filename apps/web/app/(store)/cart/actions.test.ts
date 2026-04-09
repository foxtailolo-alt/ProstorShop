import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRevalidatePath = vi.fn();
const mockRedirect = vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});

const mockProductFindUnique = vi.fn();
const mockProductFindMany = vi.fn();
const mockOrderCreate = vi.fn();
const mockTransaction = vi.fn();
const mockUserUpdate = vi.fn();
const mockPromoCodeUpdate = vi.fn();

const mockGetSession = vi.fn();
const mockGetAttributionSnapshot = vi.fn();

const mockAddCartItem = vi.fn();
const mockGetCartItems = vi.fn();
const mockClearCart = vi.fn();
const mockRemoveCartItem = vi.fn();
const mockUpdateCartItem = vi.fn();
const mockGetAppliedPromoCode = vi.fn();
const mockGetPromoCodeSummary = vi.fn();
const mockClearAppliedPromoCode = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@prostor/db", () => ({
  prisma: {
    product: {
      findUnique: mockProductFindUnique,
      findMany: mockProductFindMany,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("../../../lib/auth/session", () => ({
  getSession: mockGetSession,
}));

vi.mock("../../../lib/attribution", () => ({
  getAttributionSnapshot: mockGetAttributionSnapshot,
}));

vi.mock("../../../lib/cart", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/cart")>("../../../lib/cart");

  return {
    ...actual,
    addCartItem: mockAddCartItem,
    getCartItems: mockGetCartItems,
    clearCart: mockClearCart,
    removeCartItem: mockRemoveCartItem,
    updateCartItem: mockUpdateCartItem,
  };
});

vi.mock("../../../lib/promo", () => ({
  getAppliedPromoCode: mockGetAppliedPromoCode,
  getPromoCodeSummary: mockGetPromoCodeSummary,
  clearAppliedPromoCode: mockClearAppliedPromoCode,
  setAppliedPromoCode: vi.fn(),
}));

describe("cart actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockGetAttributionSnapshot.mockResolvedValue(null);
    mockGetCartItems.mockResolvedValue([]);
    mockGetAppliedPromoCode.mockResolvedValue(null);
    mockGetPromoCodeSummary.mockResolvedValue(null);
    mockClearAppliedPromoCode.mockResolvedValue(undefined);
    mockUserUpdate.mockResolvedValue(undefined);
    mockPromoCodeUpdate.mockResolvedValue(undefined);
    mockOrderCreate.mockResolvedValue({ id: "order-1" });
    mockTransaction.mockImplementation(async (callback: (transaction: {
      user: { update: typeof mockUserUpdate };
      order: { create: typeof mockOrderCreate };
      promoCode: { update: typeof mockPromoCodeUpdate };
    }) => Promise<unknown>) => callback({
      user: { update: mockUserUpdate },
      order: { create: mockOrderCreate },
      promoCode: { update: mockPromoCodeUpdate },
    }));
  });

  it("addToCartAction stores variant label and resolved unit price", async () => {
    const { addToCartAction } = await import("./actions");

    mockProductFindUnique.mockResolvedValue({
      price: 94990,
      options: {
        groups: [
          { name: "Storage", values: ["128GB", "256GB"] },
          { name: "Color", values: ["Black", "Blue"] },
        ],
        allVariants: true,
        variants: [
          { name: "128GB + Black", price: 99990 },
          { name: "256GB + Blue", price: 119990 },
        ],
      },
    });

    const formData = new FormData();
    formData.set("productSlug", "iphone-16");
    formData.set("quantity", "2");
    formData.set("variant", "256GB + Blue");
    formData.set("redirectTo", "/catalog/phones/iphone-16");

    await expect(addToCartAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/catalog/phones/iphone-16?added=iphone-16",
    );

    expect(mockAddCartItem).toHaveBeenCalledWith({
      productSlug: "iphone-16",
      quantity: 2,
      variantLabel: "256GB + Blue",
      unitPrice: 119990,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/cart");
  });

  it("submitOrderAction writes variant label and cart snapshot price into order items", async () => {
    const { submitOrderAction } = await import("./actions");

    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockGetAttributionSnapshot.mockResolvedValue({ source: "telegram-post" });
    mockGetCartItems.mockResolvedValue([
      {
        itemKey: "iphone-16::256GB + Blue",
        productSlug: "iphone-16",
        quantity: 2,
        variantLabel: "256GB + Blue",
        unitPrice: 119990,
      },
    ]);
    mockProductFindMany.mockResolvedValue([
      {
        id: "product-1",
        slug: "iphone-16",
        price: 94990,
        options: {
          groups: [
            { name: "Storage", values: ["128GB", "256GB"] },
            { name: "Color", values: ["Black", "Blue"] },
          ],
          allVariants: true,
          variants: [
            { name: "128GB + Black", price: 99990 },
            { name: "256GB + Blue", price: 119990 },
          ],
        },
      },
    ]);

    const formData = new FormData();
    formData.set("customerName", "Тестовый клиент");
    formData.set("phone", "+79990000000");
    formData.set("note", "Позвонить после 18:00");

    await expect(submitOrderAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/cart?success=1&orderId=order-1",
    );

    expect(mockOrderCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        customerName: "Тестовый клиент",
        phone: "+79990000000",
        note: "Позвонить после 18:00",
        total: 239980,
        attribution: { source: "telegram-post" },
        appliedPromoCodeId: null,
        promoRewardDescription: null,
        items: {
          create: [
            {
              productId: "product-1",
              quantity: 2,
              price: 119990,
              variantLabel: "256GB + Blue",
            },
          ],
        },
      },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { phone: "+79990000000" },
    });
    expect(mockClearCart).toHaveBeenCalledTimes(1);
    expect(mockClearAppliedPromoCode).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
  });
});