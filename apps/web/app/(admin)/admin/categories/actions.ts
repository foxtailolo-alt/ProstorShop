"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";

const cyrMap: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",
  л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",
  ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .split("")
    .map((ch) => cyrMap[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function syncCategoryFilters(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      attributes: {
        orderBy: { label: "asc" },
      },
      filterSets: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!category) {
    return;
  }

  const config = category.attributes
    .filter((attribute) => attribute.isFilterable)
    .map((attribute) => ({
      code: attribute.code,
      label: attribute.label,
      type: attribute.type,
      values: attribute.values,
    }));

  const activeFilterSet = category.filterSets[0];

  if (activeFilterSet) {
    await prisma.filterSet.update({
      where: { id: activeFilterSet.id },
      data: {
        name: `${category.name} filters`,
        config,
      },
    });

    return;
  }

  await prisma.filterSet.create({
    data: {
      categoryId: category.id,
      name: `${category.name} filters`,
      config,
      isActive: true,
    },
  });
}

export async function upsertCategoryAction(formData: FormData) {
  await requirePermission("categories", "write");
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const seoTitle = String(formData.get("seoTitle") ?? "").trim();
  const seoDescription = String(formData.get("seoDescription") ?? "").trim();
  const seoKeywordsRaw = String(formData.get("seoKeywords") ?? "").trim();
  const seoKeywords = seoKeywordsRaw ? seoKeywordsRaw.split(",").map((k) => k.trim()).filter(Boolean) : [];
  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  const slug = slugInput ? slugify(slugInput) : slugify(name);

  if (!name || !slug) {
    throw new Error("Category form is incomplete.");
  }

  const data = {
    name,
    slug,
    parentId,
    seoTitle: seoTitle || null,
    seoDescription: seoDescription || null,
    seoKeywords,
  };

  const category = categoryId
    ? await prisma.category.update({ where: { id: categoryId }, data })
    : await prisma.category.create({ data });

  await syncCategoryFilters(category.id);

  await logAdminActivity({
    entityType: "category",
    entityId: category.id,
    action: categoryId ? "category.updated" : "category.created",
    summary: `Категория ${name} сохранена.`,
    metadata: { slug },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
}

export async function deleteCategoryAction(formData: FormData) {
  await requirePermission("categories", "delete");
  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (!categoryId) {
    throw new Error("Category id is required.");
  }

  const [productCount, childCount] = await Promise.all([
    prisma.product.count({ where: { categoryId } }),
    prisma.category.count({ where: { parentId: categoryId } }),
  ]);

  if (childCount > 0) {
    throw new Error("Нельзя удалить категорию с подкатегориями. Сначала удалите вложенные категории.");
  }

  if (productCount > 0) {
    throw new Error("Нельзя удалить категорию, в которой есть товары.");
  }

  await prisma.attributeDefinition.deleteMany({ where: { categoryId } });
  await prisma.filterSet.deleteMany({ where: { categoryId } });
  await prisma.category.delete({ where: { id: categoryId } });

  await logAdminActivity({
    entityType: "category",
    entityId: categoryId,
    action: "category.deleted",
    summary: "Категория удалена.",
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
}

export async function upsertAttributeAction(formData: FormData) {
  await requirePermission("categories", "write");
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const codeInput = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const values = parseValues(String(formData.get("values") ?? ""));
  const isFilterable = formData.get("isFilterable") === "on";

  if (!categoryId || !codeInput || !label || !type || values.length === 0) {
    throw new Error("Attribute form is incomplete.");
  }

  const code = slugify(codeInput);

  await prisma.attributeDefinition.upsert({
    where: {
      categoryId_code: {
        categoryId,
        code,
      },
    },
    update: {
      label,
      type,
      values,
      isFilterable,
    },
    create: {
      categoryId,
      code,
      label,
      type,
      values,
      isFilterable,
    },
  });

  await syncCategoryFilters(categoryId);

  await logAdminActivity({
    entityType: "attribute-definition",
    entityId: categoryId,
    action: "category.attribute.saved",
    summary: `Атрибут ${label} сохранен для категории.`,
    metadata: { categoryId, code, type, values },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
}

export async function deleteAttributeAction(formData: FormData) {
  await requirePermission("categories", "delete");
  const attributeId = String(formData.get("attributeId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (!attributeId || !categoryId) {
    throw new Error("Attribute delete request is incomplete.");
  }

  await prisma.productAttribute.deleteMany({ where: { definitionId: attributeId } });
  await prisma.attributeDefinition.delete({ where: { id: attributeId } });
  await syncCategoryFilters(categoryId);

  await logAdminActivity({
    entityType: "attribute-definition",
    entityId: attributeId,
    action: "category.attribute.deleted",
    summary: "Атрибут категории удален.",
    metadata: { categoryId },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/activity");
  revalidatePath("/catalog");
}