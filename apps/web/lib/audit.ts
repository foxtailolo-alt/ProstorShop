import { prisma, type Prisma } from "@prostor/db";
import { getSession } from "./auth/session";

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  banner: "Баннеры",
  category: "Категории",
  customer: "Клиенты",
  "attribute-definition": "Атрибуты категорий",
  "competitor-price-review-row": "Строки проверки цен конкурентов",
  "competitor-price-sync-run": "Синхронизация цен конкурентов",
  homepage_section: "Секции главной",
  order: "Заказы",
  "promo-code": "Промокоды",
  product: "Товары",
  "service-catalog-import": "Импорт сервисного прайса",
  "service-request": "Сервисные заявки",
  "telegram-post": "Посты в Telegram",
  "trade-in-request": "Заявки Trade-in",
  "trade-in-snapshot": "Снимки Trade-in",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  delete: "Удаление",
  "category.created": "Категория создана",
  "category.deleted": "Категория удалена",
  "category.image.updated": "Обновлено изображение категории",
  "category.reordered": "Изменён порядок категорий",
  "category.updated": "Категория обновлена",
  "category.attribute.saved": "Сохранён атрибут категории",
  "competitor.pricing.row.applied": "Применена строка цены конкурента",
  "competitor.pricing.synced": "Синхронизация цен завершена",
  "customer.points.adjusted": "Баллы клиента скорректированы",
  "order.status.updated": "Обновлён статус заказа",
  "product.created": "Товар создан",
  "product.deleted": "Товар удалён",
  "product.discount.updated": "Обновлена скидка товара",
  "product.updated": "Товар обновлён",
  "service.pricing.imported": "Импортирован сервисный прайс",
  "telegram.post.published": "Пост опубликован в Telegram",
};

type AuditInput = {
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logAdminActivity(input: AuditInput) {
  const session = await getSession();

  await prisma.activityLog.create({
    data: {
      userId: session?.user.id ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata,
    },
  });
}

function humanizeAuditCode(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function formatAuditEntityType(entityType: string) {
  return AUDIT_ENTITY_LABELS[entityType] ?? humanizeAuditCode(entityType);
}

export function formatAuditAction(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? humanizeAuditCode(action);
}

function formatMetadataValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  return null;
}

export function getAuditMetadataEntries(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata)
    .map(([key, value]) => {
      const formatted = formatMetadataValue(value);

      return formatted ? { key, value: formatted } : null;
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));
}