"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { saveProductImages, saveProductImage } from "../../../../lib/media";

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
    revalidatePath("/admin/activity");
    revalidatePath("/catalog");
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
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
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

  await logAdminActivity({
    entityType: "product",
    entityId: product.id,
    action: "product.stock.toggled",
    summary: `Наличие товара ${sku} изменено на ${!current ? "в наличии" : "под заказ"}.`,
    metadata: { sku, inStock: !current },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
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
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
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

export async function cropProductImageAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const cx = Number(formData.get("cx"));
  const cy = Number(formData.get("cy"));
  const cw = Number(formData.get("cw"));
  const ch = Number(formData.get("ch"));

  if (!sku || !imageUrl || !cw || !ch) {
    throw new Error("Invalid crop request.");
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
  const croppedBuffer = await sharp(inputBuffer)
    .extract({ left: cx, top: cy, width: cw, height: ch })
    .webp({ quality: 92 })
    .toBuffer();

  const file = new File([new Uint8Array(croppedBuffer)], "cropped.webp", { type: "image/webp" });
  const newUrl = await saveProductImage(file, product.slug);
  if (!newUrl) throw new Error("Failed to save cropped image.");

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

export async function removeImageBackgroundAction(formData: FormData) {
  await requirePermission("products", "write");
  const sku = String(formData.get("sku") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();

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
  const totalPixels = info.width * info.height;

  // Sample corners to determine background color
  const samplePositions = [
    0,
    info.width - 1,
    (info.height - 1) * info.width,
    totalPixels - 1,
  ];

  let bgR = 0, bgG = 0, bgB = 0, samples = 0;
  for (const pos of samplePositions) {
    const i = pos * 4;
    bgR += pixels[i]!;
    bgG += pixels[i + 1]!;
    bgB += pixels[i + 2]!;
    samples++;
  }
  bgR = Math.round(bgR / samples);
  bgG = Math.round(bgG / samples);
  bgB = Math.round(bgB / samples);

  // Make similar-colored pixels transparent
  const tolerance = 42;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx]!;
    const g = pixels[idx + 1]!;
    const b = pixels[idx + 2]!;

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

    if (dist < tolerance) {
      pixels[idx + 3] = 0;
    } else if (dist < tolerance * 1.5) {
      const alpha = Math.round(((dist - tolerance) / (tolerance * 0.5)) * 255);
      pixels[idx + 3] = Math.min(pixels[idx + 3]!, alpha);
    }
  }

  // Save as PNG
  const resultBuffer = await sharp(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  const { randomUUID } = await import("node:crypto");
  const fsMod = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const root = process.env.UPLOADS_DIR?.trim()
    || (process.env.NODE_ENV === "production" ? "/home/deploy/prostor-uploads" : pathMod.join(process.cwd(), "public", "uploads"));
  const uploadDir = pathMod.join(root, "products");
  await fsMod.mkdir(uploadDir, { recursive: true });
  const fileName = `${product.slug}-nobg-${randomUUID()}.png`;
  await fsMod.writeFile(pathMod.join(uploadDir, fileName), resultBuffer);
  const newUrl = `/uploads/products/${fileName}`;

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