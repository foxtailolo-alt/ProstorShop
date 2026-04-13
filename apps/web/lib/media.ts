import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const allowedMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const maxFileSize = 5 * 1024 * 1024;
const maxProductImageCount = 10;

const defaultExternalUploadRoot = "/home/deploy/prostor-uploads";

function sanitizeBaseName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function resolveUploadRoot() {
  const configuredRoot = process.env.UPLOADS_DIR?.trim() || process.env.MEDIA_STORAGE_DIR?.trim();

  if (configuredRoot) {
    return path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(process.cwd(), configuredRoot);
  }

  if (process.env.NODE_ENV === "production" && existsSync(defaultExternalUploadRoot)) {
    return defaultExternalUploadRoot;
  }

  return path.join(process.cwd(), "public", "uploads");
}

function resolveUploadDir(kind: "products" | "banners") {
  return path.join(resolveUploadRoot(), kind);
}

export async function saveProductImage(file: File, productSlug: string) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = allowedMimeTypes.get(file.type);

  if (!extension) {
    throw new Error("Only JPG, PNG, and WebP images are supported.");
  }

  if (file.size > maxFileSize) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const fileName = `${sanitizeBaseName(productSlug) || "product"}-${randomUUID()}${extension}`;
  const uploadDir = resolveUploadDir("products");
  const targetPath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(uploadDir, { recursive: true });
  await writeFile(targetPath, buffer);

  return `/uploads/products/${fileName}`;
}

export async function saveProductImages(files: File[], productSlug: string) {
  const validFiles = files.filter((file) => file && file.size > 0);

  if (validFiles.length > maxProductImageCount) {
    throw new Error("Можно загрузить не более 10 изображений за раз.");
  }

  const uploadedUrls = await Promise.all(
    validFiles.map((file) => saveProductImage(file, productSlug)),
  );

  return uploadedUrls.filter((value): value is string => Boolean(value));
}

export async function saveBannerImage(file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = allowedMimeTypes.get(file.type);

  if (!extension) {
    throw new Error("Only JPG, PNG, and WebP images are supported.");
  }

  if (file.size > maxFileSize) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const fileName = `banner-${randomUUID()}${extension}`;
  const uploadDir = resolveUploadDir("banners");
  const targetPath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(uploadDir, { recursive: true });
  await writeFile(targetPath, buffer);

  return `/uploads/banners/${fileName}`;
}