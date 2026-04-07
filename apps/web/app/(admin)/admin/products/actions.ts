"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { saveProductImages } from "../../../../lib/media";

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

export async function upsertProductAction(formData: FormData) {
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

  if (!sku || !name || !brand || !categorySlug || !Number.isFinite(price) || price <= 0) {
    throw new Error("Product form is incomplete.");
  }

  const category = await prisma.category.findUnique({ where: { slug: categorySlug } });

  if (!category) {
    throw new Error("Category not found.");
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
          inStock,
          categoryId: category.id,
        },
      });

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

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
  redirect(`/admin/products?edit=${encodeURIComponent(savedProduct.sku)}`);
}

export async function deleteProductAction(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();

  if (!sku) {
    throw new Error("SKU is required.");
  }

  const product = await prisma.product.findUnique({ where: { sku } });

  await prisma.product.delete({ where: { sku } });

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
}

export async function deleteProductImageAction(formData: FormData) {
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
  redirect(`/admin/products?edit=${encodeURIComponent(sku)}`);
}