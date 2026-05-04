import { z } from "zod";

const filterDefinitionSchema = z.object({
  code: z.string(),
  label: z.string(),
  type: z.enum(["single-select", "multi-select"]),
  values: z.array(z.string()).min(1),
});

const categorySchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  hero: z.string(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  filters: z.array(filterDefinitionSchema),
});

const productSchema = z.object({
  sku: z.string(),
  slug: z.string(),
  categorySlug: z.string(),
  name: z.string(),
  brand: z.string(),
  imageUrl: z.string().url().optional(),
  imageUrls: z.array(z.string()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  discountType: z.enum(["percent", "fixed"]).optional(),
  discountValue: z.number().positive().optional(),
  discountEndsAt: z.string().datetime().optional(),
  badge: z.string().optional(),
  summary: z.string(),
  highlights: z.array(z.string()).min(3),
  specs: z.record(z.string(), z.string()),
  attributes: z.record(z.string(), z.string()),
  inStock: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const catalogCategories = categorySchema.array().parse([
  {
    slug: "iphone",
    name: "iPhone",
    description: "Флагманские iPhone с понятной конфигурацией и быстрым выбором.",
    hero: "Линейка iPhone для тех, кто хочет быстро сравнить память, цвет и формат SIM.",
    seoTitle: "Купить iPhone в Просторе",
    seoDescription: "Актуальные iPhone с понятными конфигурациями, trade-in и быстрым оформлением заказа.",
    filters: [
      { code: "storage", label: "Память", type: "single-select", values: ["128 ГБ", "256 ГБ", "512 ГБ"] },
      { code: "color", label: "Цвет", type: "multi-select", values: ["Natural", "Black", "Blue", "Pink"] },
      { code: "sim", label: "SIM", type: "single-select", values: ["eSIM", "Nano-SIM + eSIM"] },
    ],
  },
  {
    slug: "samsung",
    name: "Samsung",
    description: "Samsung-смартфоны с акцентом на экран, батарею и память.",
    hero: "Модели Galaxy с удобной фильтрацией по экрану, памяти и цвету.",
    seoTitle: "Купить Samsung Galaxy в Просторе",
    seoDescription: "Samsung-смартфоны с удобной фильтрацией по памяти, цвету и диагонали экрана.",
    filters: [
      { code: "storage", label: "Память", type: "single-select", values: ["128 ГБ", "256 ГБ", "512 ГБ"] },
      { code: "color", label: "Цвет", type: "multi-select", values: ["Graphite", "Mint", "Navy"] },
      { code: "display", label: "Диагональ", type: "single-select", values: ["6.2\"", "6.7\"", "6.8\""] },
    ],
  },
  {
    slug: "macbook",
    name: "MacBook",
    description: "Ноутбуки для работы и учебы с фильтрами по чипу, памяти и экрану.",
    hero: "MacBook для тех, кто хочет быстро понять разницу между Air и Pro.",
    seoTitle: "Купить MacBook в Просторе",
    seoDescription: "MacBook Air и Pro с акцентом на чип, память и понятный выбор под задачу.",
    filters: [
      { code: "chip", label: "Чип", type: "single-select", values: ["M3", "M4", "M4 Pro"] },
      { code: "memory", label: "ОЗУ", type: "single-select", values: ["8 ГБ", "16 ГБ", "24 ГБ"] },
      { code: "display", label: "Диагональ", type: "single-select", values: ["13\"", "14\"", "16\""] },
    ],
  },
  {
    slug: "ipad",
    name: "iPad",
    description: "Планшеты для учебы, творчества и бизнеса с фильтрами по дисплею и памяти.",
    hero: "iPad-линейка с акцентом на сценарий использования и диагональ.",
    seoTitle: "Купить iPad в Просторе",
    seoDescription: "iPad для учебы, творчества и бизнеса с быстрым подбором по памяти и диагонали.",
    filters: [
      { code: "storage", label: "Память", type: "single-select", values: ["128 ГБ", "256 ГБ", "512 ГБ", "1 ТБ"] },
      { code: "display", label: "Диагональ", type: "single-select", values: ["11\"", "13\""] },
      { code: "connectivity", label: "Связь", type: "single-select", values: ["Wi‑Fi", "Wi‑Fi + Cellular"] },
    ],
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Аксессуары с быстрым сценарием выбора по совместимости и назначению.",
    hero: "Аксессуары без перегруза: сразу видно совместимость и ключевую выгоду.",
    seoTitle: "Аксессуары для техники в Просторе",
    seoDescription: "Наушники, зарядки и аксессуары с быстрым выбором по совместимости.",
    filters: [
      { code: "type", label: "Тип", type: "single-select", values: ["Наушники", "Зарядка", "Чехол"] },
      { code: "compatibility", label: "Совместимость", type: "multi-select", values: ["iPhone", "Samsung", "MacBook", "iPad"] },
      { code: "color", label: "Цвет", type: "multi-select", values: ["White", "Black", "Midnight"] },
    ],
  },
]);

export const catalogProducts = productSchema.array().parse([
  {
    sku: "APL-IP15PRO-256-NAT",
    slug: "iphone-15-pro-256-natural",
    categorySlug: "iphone",
    name: "iPhone 15 Pro 256 GB",
    brand: "Apple",
    imageUrl: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=600&fit=crop&q=80"],
    seoTitle: "iPhone 15 Pro 256 GB купить в Просторе",
    seoDescription: "iPhone 15 Pro 256 GB с trade-in, быстрым оформлением и поддержкой через Telegram.",
    price: 109990,
    compareAtPrice: 116990,
    badge: "Хит",
    summary: "Флагман с титановой рамкой, мощной камерой и удобным переходом на eSIM.",
    highlights: ["A17 Pro", "Титановый корпус", "Премиальная камера"],
    specs: {
      Экран: '6.1" OLED',
      Память: "256 ГБ",
      SIM: "eSIM",
      Цвет: "Natural",
    },
    attributes: {
      storage: "256 ГБ",
      color: "Natural",
      sim: "eSIM",
    },
    featured: true,
    inStock: true,
  },
  {
    sku: "APL-IP16-128-PINK",
    slug: "iphone-16-128-pink",
    categorySlug: "iphone",
    name: "iPhone 16 128 GB",
    brand: "Apple",
    imageUrl: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&h=600&fit=crop&q=80"],
    seoTitle: "iPhone 16 128 GB купить в Просторе",
    seoDescription: "iPhone 16 128 GB с понятной ценой, быстрым заказом и консультацией через Telegram.",
    price: 84990,
    summary: "Быстрый и понятный вариант для повседневного использования и фото.",
    highlights: ["128 ГБ", "Легкий корпус", "Быстрая зарядка"],
    specs: {
      Экран: '6.1" OLED',
      Память: "128 ГБ",
      SIM: "Nano-SIM + eSIM",
      Цвет: "Pink",
    },
    attributes: {
      storage: "128 ГБ",
      color: "Pink",
      sim: "Nano-SIM + eSIM",
    },
    inStock: true,
  },
  {
    sku: "SMS-S24U-256-GRA",
    slug: "galaxy-s24-ultra-256-graphite",
    categorySlug: "samsung",
    name: "Samsung Galaxy S24 Ultra 256 GB",
    brand: "Samsung",
    imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&h=600&fit=crop&q=80"],
    seoTitle: "Samsung Galaxy S24 Ultra 256 GB купить в Просторе",
    seoDescription: "Samsung Galaxy S24 Ultra 256 GB с удобным подбором и быстрым оформлением заказа.",
    price: 102990,
    badge: "New",
    summary: "Большой экран, стилус и запас мощности для фото, видео и работы.",
    highlights: ["6.8\" AMOLED", "S Pen", "200 MP"],
    specs: {
      Экран: '6.8" AMOLED',
      Память: "256 ГБ",
      Цвет: "Graphite",
      Диагональ: '6.8"',
    },
    attributes: {
      storage: "256 ГБ",
      color: "Graphite",
      display: '6.8"',
    },
    featured: true,
    inStock: true,
  },
  {
    sku: "SMS-S24-256-MINT",
    slug: "galaxy-s24-plus-256-mint",
    categorySlug: "samsung",
    name: "Samsung Galaxy S24+ 256 GB",
    brand: "Samsung",
    imageUrl: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600&h=600&fit=crop&q=80"],
    seoTitle: "Samsung Galaxy S24+ 256 GB купить в Просторе",
    seoDescription: "Samsung Galaxy S24+ с понятными характеристиками, trade-in и консультацией в Telegram.",
    price: 76990,
    summary: "Универсальный смартфон с ярким экраном и хорошим балансом цены и характеристик.",
    highlights: ["6.7\" AMOLED", "256 ГБ", "AI-функции"],
    specs: {
      Экран: '6.7" AMOLED',
      Память: "256 ГБ",
      Цвет: "Mint",
      Диагональ: '6.7"',
    },
    attributes: {
      storage: "256 ГБ",
      color: "Mint",
      display: '6.7"',
    },
    inStock: true,
  },
  {
    sku: "APL-MBA13-M3-16-SIL",
    slug: "macbook-air-13-m3-16-512",
    categorySlug: "macbook",
    name: "MacBook Air 13 M3 16/512",
    brand: "Apple",
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop&q=80"],
    seoTitle: "MacBook Air 13 M3 16/512 купить в Просторе",
    seoDescription: "MacBook Air 13 на M3 для работы и учебы с быстрым заказом и поддержкой через Telegram.",
    price: 139990,
    summary: "Легкий ноутбук для учебы, работы и поездок с хорошим запасом памяти.",
    highlights: ["M3", "16 ГБ RAM", "До 18 часов работы"],
    specs: {
      Экран: '13" Liquid Retina',
      Чип: "M3",
      ОЗУ: "16 ГБ",
      SSD: "512 ГБ",
    },
    attributes: {
      chip: "M3",
      memory: "16 ГБ",
      display: '13"',
    },
    featured: true,
    inStock: true,
  },
  {
    sku: "APL-MBP14-M4PRO-24-1TB",
    slug: "macbook-pro-14-m4-pro-24-1tb",
    categorySlug: "macbook",
    name: "MacBook Pro 14 M4 Pro 24/1 TB",
    brand: "Apple",
    imageUrl: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&h=600&fit=crop&q=80"],
    seoTitle: "MacBook Pro 14 M4 Pro 24/1 TB купить в Просторе",
    seoDescription: "MacBook Pro 14 M4 Pro для профессиональных задач с понятной ценой и консультацией.",
    price: 229990,
    summary: "Рабочая машина для монтажа, дизайна и многозадачности без компромиссов.",
    highlights: ["M4 Pro", "24 ГБ RAM", "Liquid Retina XDR"],
    specs: {
      Экран: '14" Liquid Retina XDR',
      Чип: "M4 Pro",
      ОЗУ: "24 ГБ",
      SSD: "1 ТБ",
    },
    attributes: {
      chip: "M4 Pro",
      memory: "24 ГБ",
      display: '14"',
    },
    inStock: true,
  },
  {
    sku: "APL-IPADPRO11-M4-256",
    slug: "ipad-pro-11-m4-256",
    categorySlug: "ipad",
    name: "iPad Pro 11 M4 256 GB",
    brand: "Apple",
    imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&h=600&fit=crop&q=80"],
    seoTitle: "iPad Pro 11 M4 256 GB купить в Просторе",
    seoDescription: "iPad Pro 11 M4 256 GB для работы и творчества с быстрым оформлением и сервисной поддержкой.",
    price: 104990,
    summary: "Планшет для креатива, презентаций и мобильной работы с очень быстрым чипом.",
    highlights: ["M4", "11\" OLED", "Apple Pencil Pro"],
    specs: {
      Экран: '11" OLED',
      Память: "256 ГБ",
      Связь: "Wi‑Fi",
      Цвет: "Space Black",
    },
    attributes: {
      storage: "256 ГБ",
      display: '11"',
      connectivity: "Wi‑Fi",
    },
    featured: true,
    inStock: true,
  },
  {
    sku: "APL-AIRPODS-PRO2",
    slug: "airpods-pro-2-usb-c",
    categorySlug: "accessories",
    name: "AirPods Pro 2 USB‑C",
    brand: "Apple",
    imageUrl: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=600&fit=crop&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=600&fit=crop&q=80"],
    seoTitle: "AirPods Pro 2 USB-C купить в Просторе",
    seoDescription: "AirPods Pro 2 USB-C с шумоподавлением и быстрой консультацией по совместимости.",
    price: 23990,
    summary: "Премиальные наушники с шумоподавлением и понятной совместимостью с Apple-устройствами.",
    highlights: ["ANC", "USB‑C", "Прозрачный режим"],
    specs: {
      Тип: "Наушники",
      Совместимость: "iPhone, iPad, MacBook",
      Цвет: "White",
      Кейc: "USB‑C",
    },
    attributes: {
      type: "Наушники",
      compatibility: "iPhone",
      color: "White",
    },
    inStock: true,
  },
]);

export type CatalogCategory = (typeof catalogCategories)[number];
export type CatalogProduct = (typeof catalogProducts)[number];
export type FilterDefinition = CatalogCategory["filters"][number];

export function getCategoryBySlug(slug: string) {
  return catalogCategories.find((category) => category.slug === slug);
}

export function getProductsByCategory(slug: string) {
  return catalogProducts.filter((product) => product.categorySlug === slug);
}

export function getProductBySlug(categorySlug: string, productSlug: string) {
  return catalogProducts.find(
    (product) => product.categorySlug === categorySlug && product.slug === productSlug,
  );
}

export function getCatalogSummary() {
  const productsInStock = catalogProducts.filter((product) => product.inStock).length;
  const featuredProducts = catalogProducts.filter((product) => product.featured).length;

  return {
    categories: catalogCategories.length,
    products: catalogProducts.length,
    productsInStock,
    featuredProducts,
  };
}