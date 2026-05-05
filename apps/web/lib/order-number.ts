const ORDER_NUMBER_PREFIX = "A";
const ORDER_NUMBER_MIN = 10000;
const ORDER_NUMBER_SPAN = 90000;

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

export function generateOrderNumberCandidate(random = Math.random) {
  const digits = Math.floor(random() * ORDER_NUMBER_SPAN) + ORDER_NUMBER_MIN;
  return `${ORDER_NUMBER_PREFIX}${digits}`;
}

export async function generateUniqueOrderNumber(
  exists: (candidate: string) => Promise<boolean>,
  maxAttempts = 12,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateOrderNumberCandidate();

    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  throw new Error("Не удалось подобрать уникальный номер заказа.");
}

export function isOrderNumberConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const prismaError = error as {
    code?: unknown;
    meta?: {
      target?: unknown;
    };
  };

  if (prismaError.code !== "P2002") {
    return false;
  }

  const target = prismaError.meta?.target;
  return Array.isArray(target) ? target.includes("orderNumber") : target === "orderNumber";
}

export function formatOrderNumber(input: {
  orderNumber?: string | null;
  id: string;
  createdAt: Date | string;
}) {
  if (input.orderNumber?.trim()) {
    return input.orderNumber.trim();
  }

  const createdAt = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  const seed = Number.isFinite(createdAt.getTime()) ? `${input.id}:${createdAt.toISOString()}` : input.id;
  const digits = (hashString(seed) % ORDER_NUMBER_SPAN) + ORDER_NUMBER_MIN;

  return `${ORDER_NUMBER_PREFIX}${digits}`;
}