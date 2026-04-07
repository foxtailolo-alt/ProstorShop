import {
  adminRoles,
  catalogCategories,
  catalogProducts,
  defaultFeatureFlags,
  servicePriceRows,
  tradeInRules,
} from "@prostor/core";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const role of adminRoles) {
    await prisma.role.upsert({
      where: { code: role },
      update: { name: role },
      create: { code: role, name: role },
    });
  }

  for (const [key, enabled] of Object.entries(defaultFeatureFlags)) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    });
  }

  for (const category of catalogCategories) {
    const categoryRecord = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
      },
      create: {
        slug: category.slug,
        name: category.name,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
      },
    });

    await prisma.filterSet.upsert({
      where: { id: `${category.slug}-default` },
      update: {
        name: `${category.name} filters`,
        config: category.filters,
        isActive: true,
      },
      create: {
        id: `${category.slug}-default`,
        categoryId: categoryRecord.id,
        name: `${category.name} filters`,
        config: category.filters,
        isActive: true,
      },
    });

    for (const filter of category.filters) {
      await prisma.attributeDefinition.upsert({
        where: {
          categoryId_code: {
            categoryId: categoryRecord.id,
            code: filter.code,
          },
        },
        update: {
          label: filter.label,
          type: filter.type,
          values: filter.values,
          isFilterable: true,
        },
        create: {
          categoryId: categoryRecord.id,
          code: filter.code,
          label: filter.label,
          type: filter.type,
          values: filter.values,
          isFilterable: true,
        },
      });
    }
  }

  for (const product of catalogProducts) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.categorySlug },
      include: { attributes: true },
    });

    const productRecord = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        imageUrl: product.imageUrl,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        description: product.summary,
        price: product.price,
        inStock: product.inStock,
        categoryId: category.id,
      },
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        brand: product.brand,
        imageUrl: product.imageUrl,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        description: product.summary,
        price: product.price,
        inStock: product.inStock,
        categoryId: category.id,
      },
    });

    await prisma.productAttribute.deleteMany({
      where: { productId: productRecord.id },
    });

    for (const [code, value] of Object.entries(product.attributes)) {
      const definition = category.attributes.find((item) => item.code === code);

      if (!definition) {
        continue;
      }

      await prisma.productAttribute.create({
        data: {
          productId: productRecord.id,
          definitionId: definition.id,
          value,
        },
      });
    }
  }

  await prisma.tradeInRule.deleteMany();
  await prisma.tradeInRule.createMany({
    data: tradeInRules,
  });

  await prisma.servicePriceTable.upsert({
    where: { id: "starter-service-v1" },
    update: {
      version: 1,
      sourceFile: "starter-seed",
      isActive: true,
    },
    create: {
      id: "starter-service-v1",
      version: 1,
      sourceFile: "starter-seed",
      isActive: true,
    },
  });

  await prisma.servicePriceRow.deleteMany({
    where: { tableId: "starter-service-v1" },
  });

  await prisma.servicePriceRow.createMany({
    data: servicePriceRows.map((row) => ({
      tableId: "starter-service-v1",
      brand: row.brand,
      model: row.model,
      repairType: row.repairType,
      price: row.price,
    })),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });