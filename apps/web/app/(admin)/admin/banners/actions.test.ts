import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRevalidatePath = vi.fn();
const mockBannerCount = vi.fn();
const mockBannerCreate = vi.fn();
const mockBannerDelete = vi.fn();
const mockBannerFindUnique = vi.fn();
const mockBannerUpdate = vi.fn();
const mockLogAdminActivity = vi.fn();
const mockRequirePermission = vi.fn();
const mockSaveBannerImage = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@prostor/db", () => ({
  prisma: {
    banner: {
      count: mockBannerCount,
      create: mockBannerCreate,
      delete: mockBannerDelete,
      findUnique: mockBannerFindUnique,
      update: mockBannerUpdate,
    },
    category: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/audit", () => ({
  logAdminActivity: mockLogAdminActivity,
}));

vi.mock("../../../../lib/auth/session", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("../../../../lib/media", () => ({
  saveBannerImage: mockSaveBannerImage,
}));

describe("banner actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(undefined);
    mockBannerCount.mockResolvedValue(0);
    mockBannerCreate.mockResolvedValue({ id: "banner-1" });
    mockBannerFindUnique.mockResolvedValue({
      id: "banner-1",
      title: "Весенняя акция",
      linkUrl: "/catalog/iphone",
      categorySlug: null,
      isActive: false,
    });
    mockBannerUpdate.mockResolvedValue({ id: "banner-1" });
    mockBannerDelete.mockResolvedValue({ id: "banner-1" });
    mockSaveBannerImage.mockResolvedValue("/uploads/banners/new-banner.jpg");
  });

  it("creates a banner and logs activity", async () => {
    const { upsertBannerAction } = await import("./actions");

    const formData = new FormData();
    formData.set("title", "Весенняя акция");
    formData.set("linkUrl", "/catalog/iphone");
    formData.set("sortOrder", "3");
    formData.set("isActive", "on");
    formData.set("existingImageUrl", "");
    formData.set("imageFile", new File(["banner"], "banner.jpg", { type: "image/jpeg" }));

    await upsertBannerAction(formData);

    expect(mockRequirePermission).toHaveBeenCalledWith("banners", "write");
    expect(mockSaveBannerImage).toHaveBeenCalledTimes(1);
    expect(mockBannerCreate).toHaveBeenCalledWith({
      data: {
        title: "Весенняя акция",
        imageUrl: "/uploads/banners/new-banner.jpg",
        linkUrl: "/catalog/iphone",
        categorySlug: null,
        sortOrder: 3,
        isActive: true,
      },
    });
    expect(mockLogAdminActivity).toHaveBeenCalledWith({
      entityType: "banner",
      entityId: "banner-1",
      action: "create",
      summary: "Баннер создан: Весенняя акция (главная страница)",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/banners");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("blocks creating an active banner when the active limit is reached", async () => {
    const { upsertBannerAction } = await import("./actions");
    mockBannerCount.mockResolvedValue(5);

    const formData = new FormData();
    formData.set("title", "Лимитный баннер");
    formData.set("linkUrl", "/catalog/macbook");
    formData.set("sortOrder", "1");
    formData.set("isActive", "on");
    formData.set("existingImageUrl", "/uploads/banners/existing.jpg");

    await expect(upsertBannerAction(formData)).rejects.toThrow("Максимум 5 активных баннеров.");
    expect(mockBannerCreate).not.toHaveBeenCalled();
  });

  it("deletes an existing banner and writes an audit log", async () => {
    const { deleteBannerAction } = await import("./actions");

    const formData = new FormData();
    formData.set("bannerId", "banner-1");

    await deleteBannerAction(formData);

    expect(mockRequirePermission).toHaveBeenCalledWith("banners", "delete");
    expect(mockBannerDelete).toHaveBeenCalledWith({ where: { id: "banner-1" } });
    expect(mockLogAdminActivity).toHaveBeenCalledWith({
      entityType: "banner",
      entityId: "banner-1",
      action: "delete",
      summary: "Баннер удалён: Весенняя акция (главная страница)",
    });
  });

  it("creates a category banner with placement scope", async () => {
    const { prisma } = await import("@prostor/db");
    const { upsertBannerAction } = await import("./actions");

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: "category-1",
      slug: "iphone",
      name: "iPhone",
      imageUrl: null,
      position: 0,
      parentId: null,
      seoTitle: null,
      seoDescription: null,
      seoKeywords: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const formData = new FormData();
    formData.set("title", "iPhone баннер");
    formData.set("placement", "category");
    formData.set("categorySlug", "iphone");
    formData.set("linkUrl", "/catalog/iphone");
    formData.set("sortOrder", "1");
    formData.set("isActive", "on");
    formData.set("existingImageUrl", "/uploads/banners/existing.jpg");

    await upsertBannerAction(formData);

    expect(mockBannerCount).toHaveBeenCalledWith({
      where: {
        isActive: true,
        categorySlug: "iphone",
      },
    });
    expect(mockBannerCreate).toHaveBeenCalledWith({
      data: {
        title: "iPhone баннер",
        imageUrl: "/uploads/banners/existing.jpg",
        linkUrl: "/catalog/iphone",
        categorySlug: "iphone",
        sortOrder: 1,
        isActive: true,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/catalog/iphone");
  });

  it("prevents activating a sixth banner", async () => {
    const { toggleBannerActiveAction } = await import("./actions");
    mockBannerFindUnique.mockResolvedValue({
      id: "banner-1",
      title: "Запасной баннер",
      linkUrl: "/catalog/ipad",
      categorySlug: null,
      isActive: false,
    });
    mockBannerCount.mockResolvedValue(5);

    const formData = new FormData();
    formData.set("bannerId", "banner-1");

    await expect(toggleBannerActiveAction(formData)).rejects.toThrow("Максимум 5 активных баннеров.");
    expect(mockBannerUpdate).not.toHaveBeenCalled();
  });

  it("toggles banner active state when capacity is available", async () => {
    const { toggleBannerActiveAction } = await import("./actions");
    mockBannerFindUnique.mockResolvedValue({
      id: "banner-1",
      title: "Запасной баннер",
      linkUrl: "/catalog/ipad",
      categorySlug: null,
      isActive: false,
    });
    mockBannerCount.mockResolvedValue(4);

    const formData = new FormData();
    formData.set("bannerId", "banner-1");

    await toggleBannerActiveAction(formData);

    expect(mockBannerUpdate).toHaveBeenCalledWith({
      where: { id: "banner-1" },
      data: { isActive: true },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/banners");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});