"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { applyBackgroundRemoval, clampBackgroundRemovalTolerance } from "../../../../lib/background-removal";
import { saveProductImages, saveProductImage } from "../../../../lib/media";
import { processUsedDeviceWaitlistMatchesForProduct } from "../../../../lib/used-device-waitlist-notifications";

const maxProductImageCount = 10;

function parseImageUrlList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueImageUrls(values: string[]) {
  return Array.from(new Set(values));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export async function upsertProductAction(
  _: { error: string | null; savedSku: string | null; successMessage: string | null; savedAt: number | null },
  formData: FormData,
): Promise<{ error: string | null; savedSku: string | null; successMessage: string | null; savedAt: number | null }> {
  let savedSku = "";
  let savedName = "";

  try {
    await requirePermission("products", "write");
    const productId = String(formData.get("productId") ?? "").trim();
    const originalSku = String(formData.get("originalSku") ?? "").trim();
    const sku = String(formData.get("sku") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const brand = String(formData.get("brand") ?? "").trim();
    const categorySlug = String(formData.get("categorySlug") ?? "").trim();
    const price = Number(formData.get("price") ?? 0);
    const imageUrlsInput = String(formData.get("imageUrls") ?? "").trim();
    const imageFiles = formData
      .getAll("imageFiles")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const seoTitle = String(formData.get("seoTitle") ?? "").trim();
    const seoDescription = String(formData.get("seoDescription") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const inStock = formData.get("inStock") === "on";
    const specsRaw = String(formData.get("specs") ?? "").trim();
    let specs: Record<string, string> | undefined = undefined;
    if (specsRaw) {
      try {
        const parsed = JSON.parse(specsRaw);
        if (typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
          specs = parsed;
        }
      } catch { /* ignore invalid JSON */ }
    }

    const optionsRaw = String(formData.get("options") ?? "").trim();
    let optionsValue: string | undefined = undefined;
    if (optionsRaw) {
      try {
        const parsed = JSON.parse(optionsRaw);
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed?.groups?.length > 0) {
          optionsValue = optionsRaw;
        }
      } catch { /* ignore invalid JSON */ }
    }

    if (!sku || !name || !brand || !categorySlug || !Number.isFinite(price) || price <= 0) {
      throw new Error("Product form is incomplete.");
    }

    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
      include: { _count: { select: { children: true } } },
    });

    if (!category) {
      throw new Error("Category not found.");
    }

    if (category._count.children > 0) {
      throw new Error("Товар можно добавлять только в конечную категорию без подкатегорий.");
    }

    const productSlug = slugify(name);
    const existingProduct = productId
      ? await prisma.product.findUnique({ where: { id: productId } })
      : await prisma.product.findUnique({ where: { sku: originalSku || sku } });

    if (!existingProduct && (productId || originalSku)) {
      throw new Error("Product not found.");
    }

    const duplicateSkuProduct = await prisma.product.findUnique({ where: { sku } });

    if (duplicateSkuProduct && duplicateSkuProduct.id !== existingProduct?.id) {
      throw new Error("SKU already exists.");
    }

    const manualImageUrls = parseImageUrlList(imageUrlsInput);
    const uploadedImageUrls = await saveProductImages(imageFiles, productSlug);
    const existingImageUrls = existingProduct
      ? uniqueImageUrls([
          ...(existingProduct.imageUrls ?? []),
          ...(existingProduct.imageUrl ? [existingProduct.imageUrl] : []),
        ])
      : [];
    const finalImageUrlsSource =
      manualImageUrls.length > 0 || uploadedImageUrls.length > 0
        ? [...manualImageUrls, ...uploadedImageUrls]
        : existingImageUrls;
    const finalImageUrls = uniqueImageUrls(finalImageUrlsSource).slice(0, maxProductImageCount);

    if (manualImageUrls.length + uploadedImageUrls.length > maxProductImageCount) {
      throw new Error("У товара может быть не более 10 изображений.");
    }

    const finalImageUrl = finalImageUrls[0] ?? null;

    const savedProduct = existingProduct
      ? await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            sku,
            name,
            brand,
            slug: productSlug,
            price,
            imageUrl: finalImageUrl,
            imageUrls: finalImageUrls,
            seoTitle: seoTitle || null,
            seoDescription: seoDescription || null,
            description,
            specs,
            options: optionsValue ? JSON.parse(optionsValue) : undefined,
            inStock,
            categoryId: category.id,
          },
        })
      : await prisma.product.create({
          data: {
            sku,
            name,
            brand,
            slug: productSlug,
            price,
            imageUrl: finalImageUrl,
            imageUrls: finalImageUrls,
            seoTitle: seoTitle || null,
            seoDescription: seoDescription || null,
            description,
            specs,
            options: optionsValue ? JSON.parse(optionsValue) : undefined,
            inStock,
            categoryId: category.id,
          },
        });

    if (savedProduct.inStock) {
      await processUsedDeviceWaitlistMatchesForProduct(savedProduct.id).catch(() => null);
    }

    const recommendedIdsRaw = String(formData.get("recommendedIds") ?? "").trim();
    const recommendedIds = recommendedIdsRaw
      ? recommendedIdsRaw.split(",").filter(Boolean)
      : [];

    await prisma.productRecommendation.deleteMany({
      where: { sourceProductId: savedProduct.id },
    });

    if (recommendedIds.length > 0) {
      await prisma.productRecommendation.createMany({
        data: recommendedIds.map((recId, index) => ({
          sourceProductId: savedProduct.id,
          recommendedProductId: recId,
          position: index,
        })),
        skipDuplicates: true,
      });
    }

    await logAdminActivity({
      entityType: "product",
      entityId: savedProduct.id,
      action: existingProduct ? "product.updated" : "product.created",
      summary: `${name} (${sku}) сохранен в категории ${category.name}.`,
      metadata: {
        sku,
        categorySlug,
        inStock,
        price,
        imageCount: finalImageUrls.length,
      },
    });

    savedSku = savedProduct.sku;
    savedName = savedProduct.name;

    revalidatePath("/admin/products");
    revalidatePath("/admin");
    revalidatePath("/admin/waitlist");
    revalidatePath("/admin/activity");
    revalidatePath("/catalog");
    revalidatePath("/profile");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Не удалось сохранить товар.",
      savedSku: null,
      successMessage: null,
      savedAt: null,
    };
  }

  return {
    error: null,
    savedSku,
    successMessage: `Товар ${savedName || savedSku} сохранен успешно.`,
    savedAt: Date.now(),
  };
}

export async function deleteProductAction(formData: FormData) {
  await requirePermission("products", "delete");
  const sku = String(formData.get("sku") ?? "").trim();

  if (!sku) {
    throw new Error("SKU is required.");
  }

  const product = await prisma.product.findUnique({ where: { sku } });

  await prisma.product.delete({ where: { sku } }).catch((err: unknown) => {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2003") {
      throw new Error("Невозможно удалить товар: на него ссылаются заказы. Скройте товар вместо удаления.");
    }
    throw err;
  });

  await logAdminActivity({
    entityType: "product",
    entityId: product?.id,
    action: "product.deleted",
    summary: `Товар ${sku} удален из каталога.`,
    metadata: { sku },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/admin/waitlist");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
  revalidatePath("/profile");
}

export async function toggleProductStockAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const current = String(formData.get("current") ?? "false") === "true";

  if (!sku) {
    throw new Error("SKU is required.");
  }

  const product = await prisma.product.update({
    where: { sku },
    data: { inStock: !current },
  });

  if (product.inStock) {
    await processUsedDeviceWaitlistMatchesForProduct(product.id).catch(() => null);
  }

  await logAdminActivity({
    entityType: "product",
    entityId: product.id,
    action: "product.stock.toggled",
    summary: `Наличие товара ${sku} изменено на ${!current ? "в наличии" : "под заказ"}.`,
    metadata: { sku, inStock: !current },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/admin/waitlist");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
  revalidatePath("/profile");
}

export async function updateProductAttributeAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();

  if (!sku || !code) {
    throw new Error("Product attribute request is incomplete.");
  }

  const product = await prisma.product.findUnique({
    where: { sku },
    include: {
      category: true,
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  const definition = await prisma.attributeDefinition.findUnique({
    where: {
      categoryId_code: {
        categoryId: product.categoryId,
        code,
      },
    },
  });

  if (!definition) {
    throw new Error("Attribute definition not found.");
  }

  if (!value) {
    await prisma.productAttribute.deleteMany({
      where: {
        productId: product.id,
        definitionId: definition.id,
      },
    });
  } else {
    await prisma.productAttribute.upsert({
      where: {
        productId_definitionId: {
          productId: product.id,
          definitionId: definition.id,
        },
      },
      update: { value },
      create: {
        productId: product.id,
        definitionId: definition.id,
        value,
      },
    });
  }

  if (product.inStock) {
    await processUsedDeviceWaitlistMatchesForProduct(product.id).catch(() => null);
  }

  await logAdminActivity({
    entityType: "product-attribute",
    entityId: product.id,
    action: value ? "product.attribute.updated" : "product.attribute.cleared",
    summary: `Характеристика ${code} для ${product.name} ${value ? "установлена" : "очищена"}.`,
    metadata: {
      sku,
      code,
      value: value || null,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/admin/waitlist");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
  revalidatePath("/profile");
  revalidatePath(`/catalog/${product.category.slug}/${product.slug}`);
}

export async function reorderProductImagesAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const orderedUrls = JSON.parse(String(formData.get("imageUrls") ?? "[]")) as string[];

  if (!sku || !Array.isArray(orderedUrls)) {
    throw new Error("Invalid reorder request.");
  }

  const product = await prisma.product.findUnique({ where: { sku } });

  if (!product) {
    throw new Error("Product not found.");
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      imageUrls: orderedUrls,
      imageUrl: orderedUrls[0] ?? null,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${product.slug}`);
}

export async function deleteProductImageAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();

  if (!sku || !imageUrl) {
    throw new Error("Invalid delete image request.");
  }

  const product = await prisma.product.findUnique({ where: { sku } });

  if (!product) {
    throw new Error("Product not found.");
  }

  const currentUrls = product.imageUrls ?? [];
  const updatedUrls = currentUrls.filter((url) => url !== imageUrl);

  await prisma.product.update({
    where: { id: product.id },
    data: {
      imageUrls: updatedUrls,
      imageUrl: updatedUrls[0] ?? null,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${product.slug}`);
}

export async function replaceProductImageAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const oldUrl = String(formData.get("oldUrl") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!sku || !oldUrl || !file || file.size === 0) {
    throw new Error("Invalid replace image request.");
  }

  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) throw new Error("Product not found.");

  const newUrl = await saveProductImage(file, product.slug);
  if (!newUrl) throw new Error("Failed to save image.");

  const urls = product.imageUrls ?? [];
  const updatedUrls = urls.map((url) => (url === oldUrl ? newUrl : url));

  await prisma.product.update({
    where: { id: product.id },
    data: {
      imageUrls: updatedUrls,
      imageUrl: updatedUrls[0] ?? null,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  return { newUrl };
}

export async function removeImageBackgroundAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const tolerance = clampBackgroundRemovalTolerance(Number(formData.get("tolerance") ?? Number.NaN));

  if (!sku || !imageUrl) {
    throw new Error("Invalid background removal request.");
  }

  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) throw new Error("Product not found.");

  // Fetch the image
  let inputBuffer: Buffer;
  if (imageUrl.startsWith("http")) {
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error("Failed to fetch image.");
    inputBuffer = Buffer.from(await resp.arrayBuffer());
  } else {
    const fs = await import("node:fs/promises");
    const pathMod = await import("node:path");
    const root = process.env.UPLOADS_DIR?.trim()
      || (process.env.NODE_ENV === "production" ? "/home/deploy/prostor-uploads" : pathMod.join(process.cwd(), "public", "uploads"));
    const relPath = imageUrl.replace(/^\/uploads\//, "");
    inputBuffer = await fs.readFile(pathMod.join(root, relPath));
  }

  const sharp = (await import("sharp")).default;

  // Extract raw pixel data
  const { data: rawPixels, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rawPixels);
  applyBackgroundRemoval(pixels, info.width, info.height, { tolerance });

  const resultBuffer = await sharp(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  const file = new File([new Uint8Array(resultBuffer)], `${product.slug}-nobg.png`, { type: "image/png" });
  const newUrl = await saveProductImage(file, product.slug);
  if (!newUrl) throw new Error("Failed to save background-removed image.");

  const urls = product.imageUrls ?? [];
  const updatedUrls = urls.map((url) => (url === imageUrl ? newUrl : url));

  await prisma.product.update({
    where: { id: product.id },
    data: {
      imageUrls: updatedUrls,
      imageUrl: updatedUrls[0] ?? null,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  return { newUrl };
}