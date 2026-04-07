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

function sanitizeBaseName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
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