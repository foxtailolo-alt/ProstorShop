import { servicePriceRows } from "@prostor/core";
import * as XLSX from "xlsx";

type ServiceSlug = "battery-replacement" | "back-cover-replacement";

type SheetBlock = {
  nameColumn: number;
  partPriceColumn: number;
  laborPriceColumn: number;
  totalPriceColumn: number;
  serviceSlug: ServiceSlug;
  serviceName: string;
  serviceDescription: string;
  variantName: string;
  variantDescription: string;
  sourceKind: string;
  sortOrder: number;
};

export type ServiceCatalogImportRecord = {
  serviceSlug: string;
  serviceName: string;
  serviceDescription: string;
  modelName: string;
  modelSlug: string;
  brand: string;
  variantName: string;
  variantSlug: string;
  variantDescription: string;
  sourceKinds: string[];
  metadata: Record<string, unknown>;
  partPrice: number;
  laborPrice: number;
  totalPrice: number;
  currency: string;
  sourceFile: string;
  sourceLabel: string;
  serviceSortOrder: number;
  modelSortOrder: number;
  variantSortOrder: number;
};

export type ServiceCatalogEntry = ServiceCatalogImportRecord & {
  serviceId: string;
  modelId: string;
  variantId: string;
};

export type ParsedServiceCatalogWorkbook = {
  rowsRead: number;
  normalizedRows: number;
  warnings: string[];
  records: ServiceCatalogImportRecord[];
};

export type NormalizedServiceCatalogModel = {
  modelName: string;
  modelSlug: string;
  modelSortOrder: number;
};

const BATTERY_BLOCKS: SheetBlock[] = [
  {
    nameColumn: 0,
    partPriceColumn: 1,
    laborPriceColumn: 2,
    totalPriceColumn: 3,
    serviceSlug: "battery-replacement",
    serviceName: "Замена аккумулятора",
    serviceDescription: "Подберем подходящий аккумулятор и заранее зафиксируем стоимость ремонта.",
    variantName: "Оригинал",
    variantDescription: "Оригинальный аккумулятор с максимальной совместимостью и штатной работой устройства.",
    sourceKind: "battery-original",
    sortOrder: 10,
  },
  {
    nameColumn: 5,
    partPriceColumn: 6,
    laborPriceColumn: 7,
    totalPriceColumn: 8,
    serviceSlug: "battery-replacement",
    serviceName: "Замена аккумулятора",
    serviceDescription: "Подберем подходящий аккумулятор и заранее зафиксируем стоимость ремонта.",
    variantName: "Премиум копия",
    variantDescription: "Качественный аналог с отображением емкости 100% без ошибки в настройках.",
    sourceKind: "battery-premium-copy",
    sortOrder: 20,
  },
];

const COVER_BLOCKS: SheetBlock[] = [
  {
    nameColumn: 0,
    partPriceColumn: 1,
    laborPriceColumn: 2,
    totalPriceColumn: 3,
    serviceSlug: "back-cover-replacement",
    serviceName: "Замена задней крышки",
    serviceDescription: "Покажем доступные варианты крышки и сразу сообщим стоимость ремонта.",
    variantName: "Копия",
    variantDescription: "Новая крышка-замена. Цвет и итоговые нюансы установки администратор уточнит после заявки.",
    sourceKind: "cover-copy-wide-cut",
    sortOrder: 10,
  },
  {
    nameColumn: 5,
    partPriceColumn: 6,
    laborPriceColumn: 7,
    totalPriceColumn: 8,
    serviceSlug: "back-cover-replacement",
    serviceName: "Замена задней крышки",
    serviceDescription: "Покажем доступные варианты крышки и сразу сообщим стоимость ремонта.",
    variantName: "Копия",
    variantDescription: "Новая крышка-замена. Цвет и итоговые нюансы установки администратор уточнит после заявки.",
    sourceKind: "cover-copy-no-binding",
    sortOrder: 10,
  },
  {
    nameColumn: 10,
    partPriceColumn: 11,
    laborPriceColumn: 12,
    totalPriceColumn: 13,
    serviceSlug: "back-cover-replacement",
    serviceName: "Замена задней крышки",
    serviceDescription: "Покажем доступные варианты крышки и сразу сообщим стоимость ремонта.",
    variantName: "Оригинал",
    variantDescription: "Оригинальная снятая крышка с корректной привязкой и сохранением функциональности.",
    sourceKind: "cover-original-bound",
    sortOrder: 20,
  },
];

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugify(value: string) {
  const transliterated = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[а-яё]/g, (character) => CYRILLIC_TO_LATIN[character] ?? "");

  return transliterated
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function inferBrand(modelName: string) {
  if (/^(iphone|ipad|macbook|imac|apple watch)\b/i.test(modelName)) {
    return "Apple";
  }

  if (/^(samsung|galaxy)\b/i.test(modelName)) {
    return "Samsung";
  }

  if (/^(xiaomi|redmi|poco)\b/i.test(modelName)) {
    return "Xiaomi";
  }

  if (/^honor\b/i.test(modelName)) {
    return "Honor";
  }

  if (/^huawei\b/i.test(modelName)) {
    return "Huawei";
  }

  return modelName.split(/\s+/)[0] ?? "Устройство";
}

function extractBatteryModel(name: string) {
  return name
    .replace(/^Аккумулятор\s+/i, "")
    .replace(/\s+Оригинал$/i, "")
    .replace(/\s+Premium Clean 100%$/i, "")
    .trim();
}

function extractCoverModel(name: string) {
  let result = name.replace(/^Задняя крышка \(стекло\)\s*/i, "");
  result = result.replace(/^Широкий вырез\s*/i, "");
  result = result.replace(/^в сборе с рамкой\s*/i, "");
  result = result.replace(/\s*\([^)]*\)\s*$/i, "");
  result = result.replace(/\s*\(с NFC\)/gi, "");
  result = result.replace(/\s*\(Снятый\)/gi, "");
  result = result.replace(/\s+Оригинал$/i, "");
  return result.trim();
}

function extractIphoneSeries(modelName: string) {
  const match = modelName.match(/iPhone\s+(\d+)/i);
  if (!match) {
    return null;
  }

  const series = Number(match[1]);
  return Number.isFinite(series) ? series : null;
}

function resolveVariantDescription(block: SheetBlock, modelName: string) {
  if (block.serviceSlug !== "back-cover-replacement" || block.variantName !== "Копия") {
    return block.variantDescription;
  }

  const series = extractIphoneSeries(modelName);
  if (series !== null && series >= 14) {
    return "Качественный аналог крышки. В уведомлении будет указано, что задняя крышка определяется как неизвестная деталь. Цвет и сроки мастер уточнит после оформления заявки.";
  }

  return "Качественный аналог крышки. Цвет и сроки мастер уточнит после оформления заявки.";
}

function roundPriceTo500(value: number) {
  return Math.ceil(value / 500) * 500;
}

function isUserVisibleColorTag(value: string) {
  const normalized = value.trim().toLowerCase();

  return normalized !== "стекло" && normalized !== "с nfc" && normalized !== "снятый";
}

function modelSortOrder(modelName: string) {
  const series = extractIphoneSeries(modelName);

  if (series !== null) {
    return 10_000 - series * 100 - modelName.length;
  }

  return 1_000 - modelName.length;
}

function inferSharedModelPrefix(modelName: string) {
  const tokens = modelName.trim().split(/\s+/).filter(Boolean);
  const prefixTokens: string[] = [];

  for (const token of tokens) {
    if (/^\d/.test(token) || /^[a-z]\d/i.test(token) || /^m\d/i.test(token)) {
      break;
    }

    prefixTokens.push(token);
  }

  return prefixTokens.join(" ").trim();
}

export function normalizeServiceCatalogModelNames(modelName: string): NormalizedServiceCatalogModel[] {
  const normalizedModelName = modelName.trim().replace(/\s+/g, " ");

  if (!normalizedModelName.includes("/")) {
    return [{
      modelName: normalizedModelName,
      modelSlug: slugify(normalizedModelName),
      modelSortOrder: modelSortOrder(normalizedModelName),
    }];
  }

  const parts = normalizedModelName.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [{
      modelName: normalizedModelName,
      modelSlug: slugify(normalizedModelName),
      modelSortOrder: modelSortOrder(normalizedModelName),
    }];
  }

  const sharedPrefix = inferSharedModelPrefix(parts[0] ?? normalizedModelName);
  const seen = new Set<string>();
  const normalizedModels: NormalizedServiceCatalogModel[] = [];

  for (const [index, part] of parts.entries()) {
    const resolvedName = index === 0 || !sharedPrefix || part.toLowerCase().startsWith(sharedPrefix.toLowerCase())
      ? part
      : `${sharedPrefix} ${part}`;
    const compactName = resolvedName.trim().replace(/\s+/g, " ");

    if (!compactName || seen.has(compactName)) {
      continue;
    }

    seen.add(compactName);
    normalizedModels.push({
      modelName: compactName,
      modelSlug: slugify(compactName),
      modelSortOrder: modelSortOrder(compactName),
    });
  }

  return normalizedModels.length > 0
    ? normalizedModels
    : [{
        modelName: normalizedModelName,
        modelSlug: slugify(normalizedModelName),
        modelSortOrder: modelSortOrder(normalizedModelName),
      }];
}

function toNumeric(value: unknown) {
  if (value === "" || value === null || value === undefined || value === "-") {
    return null;
  }

  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toWorkbook(buffer: Buffer) {
  return XLSX.read(buffer, { type: "buffer" });
}

function buildImportRecords(
  block: SheetBlock,
  rawName: string,
  partPrice: number,
  laborPrice: number,
  totalPrice: number,
  sourceFile: string,
): ServiceCatalogImportRecord[] {
  const rawModelName = block.serviceSlug === "battery-replacement" ? extractBatteryModel(rawName) : extractCoverModel(rawName);
  const colors = Array.from(rawName.matchAll(/\(([^)]+)\)/g))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
    .filter(isUserVisibleColorTag);

  return normalizeServiceCatalogModelNames(rawModelName).map(({ modelName, modelSlug, modelSortOrder: normalizedModelSortOrder }) => ({
    serviceSlug: block.serviceSlug,
    serviceName: block.serviceName,
    serviceDescription: block.serviceDescription,
    modelName,
    modelSlug,
    brand: inferBrand(modelName),
    variantName: block.variantName,
    variantSlug: slugify(block.variantName),
    variantDescription: resolveVariantDescription(block, modelName),
    sourceKinds: [block.sourceKind],
    metadata: colors.length > 0 ? { colors } : {},
    partPrice,
    laborPrice,
    totalPrice: roundPriceTo500(totalPrice),
    currency: "RUB",
    sourceFile,
    sourceLabel: rawName,
    serviceSortOrder: block.serviceSlug === "battery-replacement" ? 10 : 20,
    modelSortOrder: normalizedModelSortOrder,
    variantSortOrder: block.sortOrder,
  }));
}

export function parseServiceCatalogWorkbook(buffer: Buffer, sourceFile: string): ParsedServiceCatalogWorkbook {
  const workbook = toWorkbook(buffer);
  const records = new Map<string, ServiceCatalogImportRecord>();
  const warnings: string[] = [];
  let rowsRead = 0;

  const sheets: Array<{ name: string; blocks: SheetBlock[] }> = [
    { name: "Прайс АКБ", blocks: BATTERY_BLOCKS },
    { name: "Прайс Крышки (копия)", blocks: COVER_BLOCKS },
  ];

  for (const sheetConfig of sheets) {
    const sheet = workbook.Sheets[sheetConfig.name];

    if (!sheet) {
      warnings.push(`Лист "${sheetConfig.name}" не найден в Excel-файле.`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });

    for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];

      for (const block of sheetConfig.blocks) {
        const rawName = String(row[block.nameColumn] ?? "").trim();

        if (!rawName) {
          continue;
        }

        rowsRead += 1;

        const partPrice = toNumeric(row[block.partPriceColumn]);
        const laborPrice = toNumeric(row[block.laborPriceColumn]);
        const totalPrice = toNumeric(row[block.totalPriceColumn]);

        if (partPrice === null || laborPrice === null || totalPrice === null) {
          warnings.push(`Пропущена строка ${rowIndex + 1} на листе ${sheetConfig.name}: нет полной цены для "${rawName}".`);
          continue;
        }

        for (const record of buildImportRecords(block, rawName, partPrice, laborPrice, totalPrice, sourceFile)) {
          const signature = `${record.serviceSlug}::${record.modelSlug}::${record.variantSlug}`;
          const existing = records.get(signature);

          if (!existing) {
            records.set(signature, record);
            continue;
          }

          if (
            existing.totalPrice !== record.totalPrice ||
            existing.partPrice !== record.partPrice ||
            existing.laborPrice !== record.laborPrice
          ) {
            warnings.push(
              `Найдено несколько цен для ${record.serviceName} / ${record.modelName} / ${record.variantName}. Оставлена первая строка: "${existing.sourceLabel}".`,
            );
            continue;
          }

          existing.sourceKinds = Array.from(new Set([...existing.sourceKinds, ...record.sourceKinds]));

          const currentColors = Array.isArray(existing.metadata.colors) ? (existing.metadata.colors as string[]) : [];
          const nextColors = Array.isArray(record.metadata.colors) ? (record.metadata.colors as string[]) : [];
          if (currentColors.length > 0 || nextColors.length > 0) {
            existing.metadata = {
              ...existing.metadata,
              colors: Array.from(new Set([...currentColors, ...nextColors])).sort(),
            };
          }
        }
      }
    }
  }

  const normalizedRecords = Array.from(records.values()).sort((left, right) => {
    if (left.brand !== right.brand) {
      return left.brand.localeCompare(right.brand, "ru");
    }

    if (left.modelSortOrder !== right.modelSortOrder) {
      return right.modelSortOrder - left.modelSortOrder;
    }

    if (left.modelName !== right.modelName) {
      return left.modelName.localeCompare(right.modelName, "ru");
    }

    return left.variantSortOrder - right.variantSortOrder;
  });

  if (normalizedRecords.length === 0) {
    throw new Error("Не удалось разобрать Excel-прайс. Ожидаются листы 'Прайс АКБ' и/или 'Прайс Крышки (копия)' с ценами ремонта.");
  }

  return {
    rowsRead,
    normalizedRows: normalizedRecords.length,
    warnings,
    records: normalizedRecords,
  };
}

export function buildFallbackServiceCatalogEntries(): ServiceCatalogEntry[] {
  return servicePriceRows.map((row, index) => {
    const serviceSlug = slugify(row.repairType);
    const modelSlug = slugify(row.model);
    const variantSlug = "standard";

    return {
      serviceId: `fallback-service-${serviceSlug}`,
      modelId: `fallback-model-${serviceSlug}-${modelSlug}`,
      variantId: `fallback-variant-${serviceSlug}-${modelSlug}-${index}`,
      serviceSlug,
      serviceName: row.repairType,
      serviceDescription: "Базовый вариант из резервного прайса сервиса.",
      modelName: row.model,
      modelSlug,
      brand: row.brand,
      variantName: "Стандартный вариант",
      variantSlug,
      variantDescription: "Базовая цена без детализации по типу комплектующей.",
      sourceKinds: ["fallback-service-price-row"],
      metadata: {},
      partPrice: 0,
      laborPrice: row.price,
      totalPrice: row.price,
      currency: "RUB",
      sourceFile: "seed",
      sourceLabel: `${row.brand} / ${row.model} / ${row.repairType}`,
      serviceSortOrder: 100,
      modelSortOrder: modelSortOrder(row.model),
      variantSortOrder: 10,
    };
  });
}