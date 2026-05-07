type TradeInSupportedCategory = "iphone" | "mac" | "samsung" | "ipad" | "apple_watch";

type TradeInStaticQuestion = {
  code: string;
  title: string;
  options: Array<{
    code: string;
    title: string;
  }>;
};

export type TradeInSnapshotOption = {
  id?: string;
  code: string;
  title: string;
  pricingPayload: Record<string, unknown>;
  sortOrder: number;
  isEnabled: boolean;
};

export type TradeInSnapshotQuestion = {
  id?: string;
  code: string;
  title: string;
  stepIndex: number;
  questionKind: string;
  branchingRules: Record<string, unknown>;
  isRequired: boolean;
  isEnabled?: boolean;
  options: TradeInSnapshotOption[];
};

export type TradeInSnapshotModel = {
  id?: string;
  code: string;
  title: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
  isEnabled: boolean;
};

export type TradeInSnapshotCategory = {
  id?: string;
  categoryCode: TradeInSupportedCategory;
  title: string;
  models: TradeInSnapshotModel[];
  questions: TradeInSnapshotQuestion[];
  sortOrder: number;
  isEnabled: boolean;
};

export type TradeInSnapshotGraph = {
  id?: string;
  version: number;
  sourceName: string;
  pricingCity: string;
  status: string;
  importedAt: string | Date;
  categories: TradeInSnapshotCategory[];
};

export type TradeInVisibleQuestion = {
  code: string;
  title: string;
  stepIndex: number;
  options: TradeInSnapshotOption[];
  value: string;
};

export type TradeInFlowState = {
  resolvedAnswers: Record<string, string>;
  questions: TradeInVisibleQuestion[];
  isComplete: boolean;
};

export type TradeInAnswerSummaryItem = {
  code: string;
  title: string;
  value: string;
};

export type TradeInPriceQuote = {
  amount: number;
  minAmount: number;
  maxAmount: number;
  trace: Array<{
    label: string;
    amount: number;
  }>;
};

const CATEGORY_TITLES: Record<TradeInSupportedCategory, string> = {
  iphone: "iPhone",
  mac: "MacBook/iMac",
  samsung: "Samsung",
  ipad: "iPad",
  apple_watch: "Apple Watch",
};

const QUESTION_ORDER_BY_CATEGORY: Partial<Record<TradeInSupportedCategory, string[]>> = {
  mac: ["year", "cpu", "inches", "memory", "ram"],
};

const STATIC_QUESTIONS: Partial<Record<TradeInSupportedCategory, TradeInStaticQuestion[]>> = {
  iphone: [
    {
      code: "damaged",
      title: "Все функции работают?",
      options: [
        { code: "false", title: "Все работает" },
        { code: "true", title: "Есть неисправности" },
      ],
    },
    {
      code: "restored_display",
      title: "Экран менялся?",
      options: [
        { code: "0", title: "Нет" },
        { code: "1", title: "Да" },
      ],
    },
    {
      code: "exterier_condition",
      title: "Состояние корпуса и экрана",
      options: [
        { code: "best", title: "Как новый" },
        { code: "well", title: "Хорошее" },
        { code: "normal", title: "Среднее" },
        { code: "bad", title: "Плохое" },
      ],
    },
  ],
  mac: [
    {
      code: "damaged",
      title: "Есть аппаратные неисправности?",
      options: [
        { code: "false", title: "Нет, все работает" },
        { code: "true", title: "Да, есть" },
      ],
    },
  ],
  samsung: [
    {
      code: "exterier_condition_android",
      title: "Состояние корпуса и экрана",
      options: [
        { code: "best", title: "Как новый" },
        { code: "well", title: "Хорошее" },
        { code: "normal", title: "Среднее" },
      ],
    },
  ],
  ipad: [
    {
      code: "exterier_condition_ipad",
      title: "Состояние корпуса и экрана",
      options: [
        { code: "best", title: "Как новый" },
        { code: "well", title: "Хорошее" },
        { code: "normal", title: "Среднее" },
        { code: "bad", title: "Плохое" },
      ],
    },
  ],
  apple_watch: [
    {
      code: "exterier_condition_watches",
      title: "Состояние часов",
      options: [
        { code: "best", title: "Как новые" },
        { code: "well", title: "Хорошее" },
        { code: "normal", title: "Среднее" },
      ],
    },
  ],
};

const PARAMS_ENDPOINTS: Record<TradeInSupportedCategory, { path: string; payload: Record<string, string> }> = {
  iphone: { path: "iphone_buyout/params", payload: {} },
  mac: { path: "macbook_buyout/params", payload: {} },
  samsung: { path: "android_buyout/params", payload: { vendor: "samsung" } },
  ipad: { path: "ipad_buyout/params", payload: {} },
  apple_watch: { path: "watches_buyout/params", payload: {} },
};

const PRICING_ENDPOINTS: Record<TradeInSupportedCategory, string> = {
  iphone: "iphone_buyout",
  mac: "macbook_buyout",
  samsung: "android_buyout",
  ipad: "ipad_buyout",
  apple_watch: "watches_buyout",
};

function getQuestionOrderLookup(categoryCode: TradeInSupportedCategory) {
  return Object.fromEntries((QUESTION_ORDER_BY_CATEGORY[categoryCode] ?? []).map((code, index) => [code, index]));
}

function normalizeOption(payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const option = payload as Record<string, unknown>;
    const rawCode = option.abbr ?? option.name ?? "";
    const code = typeof rawCode === "boolean" ? String(rawCode).toLowerCase() : String(rawCode).trim();
    const title = String(option.name ?? option.abbr ?? "").trim();
    const pricingPayload = Object.fromEntries(Object.entries(option).filter(([key]) => key !== "name" && key !== "abbr"));
    return { code, title, pricingPayload };
  }

  const code = String(payload ?? "").trim();
  return { code, title: code, pricingPayload: {} };
}

function cloneGroupPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { vals: [] as unknown[] };
  }

  const group = payload as Record<string, unknown>;
  return {
    ...group,
    vals: Array.isArray(group.vals) ? [...group.vals] : [],
  };
}

function restoreGroupOption(option: { code: string; title: string; pricingPayload: Record<string, unknown> }) {
  return {
    ...option.pricingPayload,
    name: option.title,
    abbr: option.code,
  };
}

function normalizeRecords(payload: unknown) {
  const records = Array.isArray(payload)
    ? payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : payload && typeof payload === "object"
      ? Object.values(payload).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [];

  return records.sort((left, right) => {
    const leftPosition = Number(left.seq_position ?? 0);
    const rightPosition = Number(right.seq_position ?? 0);
    if (leftPosition !== rightPosition) {
      return rightPosition - leftPosition;
    }

    return String(left.device_name ?? left.device_abbr ?? "").localeCompare(String(right.device_name ?? right.device_abbr ?? ""), "ru");
  });
}

async function requestDamProdam(path: string, init?: RequestInit) {
  const response = await fetch(`https://damprodam.ru/py/${path}`, init);
  if (!response.ok) {
    throw new Error(`DamProdam request failed: ${path} (${response.status})`);
  }
  return response;
}

export async function fetchTradeInCategoryParams(
  categoryCode: TradeInSupportedCategory,
  payload?: Record<string, string | number | boolean | null | undefined>,
) {
  const endpoint = PARAMS_ENDPOINTS[categoryCode];
  const mergedPayload = {
    ...endpoint.payload,
    ...Object.fromEntries(Object.entries(payload ?? {}).filter(([, value]) => value !== undefined && value !== null)),
  };

  const response = await requestDamProdam(endpoint.path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mergedPayload),
  });

  return response.json();
}

export async function fetchTradeInBuyoutPrice(
  categoryCode: TradeInSupportedCategory,
  payload: Record<string, string | number | boolean | null | undefined>,
) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      continue;
    }
    body.set(key, typeof value === "boolean" ? String(value).toLowerCase() : String(value));
  }

  const response = await requestDamProdam(PRICING_ENDPOINTS[categoryCode], {
    method: "POST",
    body,
  });

  return response.json() as Promise<Record<string, unknown>>;
}

async function enrichMacRecord(record: Record<string, unknown>) {
  const enrichedRecord = { ...record };
  const params = Object.fromEntries(
    Object.entries((record.params as Record<string, unknown> | undefined) ?? {}).map(([groupCode, groupPayload]) => [String(groupCode), cloneGroupPayload(groupPayload)]),
  );
  const years = Array.isArray((params.year as { vals?: unknown[] } | undefined)?.vals)
    ? ((params.year as { vals?: unknown[] }).vals ?? []).map((year) => String(year))
    : [];
  const modelCode = String(record.device_abbr ?? "");

  for (const year of years) {
    const payload = await fetchTradeInCategoryParams("mac", {
      models_macbooks: modelCode,
      year,
    });
    const groupPayloads = (payload?.[modelCode]?.params ?? {}) as Record<string, Record<string, unknown>>;
    for (const [groupCode, groupPayload] of Object.entries(groupPayloads)) {
      const normalizedGroupCode = String(groupPayload.group_abbr ?? groupCode);
      const targetGroup = (params[normalizedGroupCode] as { vals?: unknown[] } | undefined) ?? cloneGroupPayload(groupPayload);
      const existingOptions = new Map<string, { code: string; title: string; pricingPayload: Record<string, unknown> }>();
      const currentValues = Array.isArray(targetGroup.vals) ? targetGroup.vals : [];
      for (const option of currentValues) {
        const normalized = normalizeOption(option);
        existingOptions.set(normalized.code, normalized);
      }
      for (const option of Array.isArray(groupPayload.vals) ? groupPayload.vals : []) {
        const normalized = normalizeOption(option);
        if (!existingOptions.has(normalized.code)) {
          existingOptions.set(normalized.code, normalized);
        }
      }
      params[normalizedGroupCode] = {
        ...targetGroup,
        vals: Array.from(existingOptions.values()).map(restoreGroupOption),
      };
    }
  }

  enrichedRecord.params = params;
  return enrichedRecord;
}

function buildQuestions(categoryCode: TradeInSupportedCategory, records: Record<string, unknown>[]) {
  const grouped = new Map<string, {
    title: string;
    modelOptionMap: Record<string, string[]>;
    options: Map<string, { code: string; title: string; pricingPayload: Record<string, unknown> }>;
    firstSeenStep: number;
  }>();

  for (const record of records) {
    const modelCode = String(record.device_abbr ?? "");
    const params = ((record.params as Record<string, unknown> | undefined) ?? {});
    let fallbackStep = 0;
    for (const [groupCode, groupPayload] of Object.entries(params)) {
      fallbackStep += 1;
      const payload = groupPayload as Record<string, unknown>;
      const normalizedGroupCode = String(payload.group_abbr ?? groupCode);
      const bucket = grouped.get(normalizedGroupCode) ?? {
        title: String(payload.group_name ?? normalizedGroupCode),
        modelOptionMap: {},
        options: new Map<string, { code: string; title: string; pricingPayload: Record<string, unknown> }>(),
        firstSeenStep: grouped.size + fallbackStep,
      };
      bucket.modelOptionMap[modelCode] = [];
      for (const option of Array.isArray(payload.vals) ? payload.vals : []) {
        const normalized = normalizeOption(option);
        bucket.modelOptionMap[modelCode].push(normalized.code);
        if (!bucket.options.has(normalized.code)) {
          bucket.options.set(normalized.code, normalized);
        }
      }
      grouped.set(normalizedGroupCode, bucket);
    }
  }

  const questionOrderLookup = getQuestionOrderLookup(categoryCode);
  const orderedDynamicQuestions = Array.from(grouped.entries())
    .sort((left, right) => {
      const leftPriority = questionOrderLookup[left[0]];
      const rightPriority = questionOrderLookup[right[0]];
      if (leftPriority !== undefined || rightPriority !== undefined) {
        return (leftPriority ?? Number.MAX_SAFE_INTEGER) - (rightPriority ?? Number.MAX_SAFE_INTEGER);
      }
      return left[1].firstSeenStep - right[1].firstSeenStep;
    })
    .map<TradeInSnapshotQuestion>(([code, bucket], index) => {
      const options = Array.from(bucket.options.values());
      const orderedOptions = options.every((item) => item.code.replace(/^-/, "").match(/^\d+$/))
        ? options.sort((left, right) => Number(left.code) - Number(right.code))
        : options;

      return {
        code,
        title: bucket.title,
        stepIndex: index + 1,
        questionKind: "single_select",
        branchingRules: {
          model_option_map: bucket.modelOptionMap,
        },
        isRequired: true,
        options: orderedOptions.map((option, optionIndex) => ({
          code: option.code,
          title: option.title,
          pricingPayload: option.pricingPayload,
          sortOrder: optionIndex,
          isEnabled: true,
        })),
      };
    });

  const staticQuestions = (STATIC_QUESTIONS[categoryCode] ?? []).map<TradeInSnapshotQuestion>((question, index) => ({
    code: question.code,
    title: question.title,
    stepIndex: orderedDynamicQuestions.length + index + 1,
    questionKind: "single_select",
    branchingRules: {},
    isRequired: true,
    options: question.options.map((option, optionIndex) => ({
      code: option.code,
      title: option.title,
      pricingPayload: {},
      sortOrder: optionIndex,
      isEnabled: true,
    })),
  }));

  return [...orderedDynamicQuestions, ...staticQuestions];
}

export async function importTradeInSnapshotSchema() {
  const categoryCodes = Object.keys(CATEGORY_TITLES) as TradeInSupportedCategory[];
  const categories: TradeInSnapshotCategory[] = [];

  for (const [sortOrder, categoryCode] of categoryCodes.entries()) {
    const payload = await fetchTradeInCategoryParams(categoryCode);
    const normalizedRecords = normalizeRecords(payload);
    const records = categoryCode === "mac"
      ? await Promise.all(normalizedRecords.map((record) => enrichMacRecord(record)))
      : normalizedRecords;

    categories.push({
      categoryCode,
      title: CATEGORY_TITLES[categoryCode],
      sortOrder,
      isEnabled: true,
      models: records.map((record, index) => ({
        code: String(record.device_abbr ?? ""),
        title: String(record.device_name ?? record.device_abbr ?? ""),
        metadata: {
          sourceSeqPosition: record.seq_position,
          modelSeries: record.model_series,
          params: record.params ?? {},
        },
        sortOrder: index,
        isEnabled: true,
      })),
      questions: buildQuestions(categoryCode, records),
    });
  }

  return {
    version: 1,
    sourceName: "damprodam_api",
    pricingCity: "moscow",
    status: "active",
    importedAt: new Date().toISOString(),
    categories,
  } satisfies Omit<TradeInSnapshotGraph, "id">;
}

export function getActiveTradeInCategories(snapshot: TradeInSnapshotGraph) {
  return [...snapshot.categories]
    .filter((category) => category.isEnabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getTradeInModels(snapshot: TradeInSnapshotGraph, categoryCode: string) {
  const category = snapshot.categories.find((item) => item.categoryCode === categoryCode);
  if (!category) {
    return [] as TradeInSnapshotModel[];
  }

  return [...category.models]
    .filter((model) => model.isEnabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function buildQuestionOptions(question: TradeInSnapshotQuestion, modelCode: string) {
  const modelOptionMap = question.branchingRules.model_option_map;
  const allowedCodes = modelOptionMap && typeof modelOptionMap === "object" && !Array.isArray(modelOptionMap)
    ? (modelOptionMap as Record<string, string[]>)[modelCode]
    : undefined;
  const allowedSet = Array.isArray(allowedCodes) ? new Set(allowedCodes) : null;

  return [...question.options]
    .filter((option) => option.isEnabled && (!allowedSet || allowedSet.has(option.code)))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function buildTradeInFlowState(
  snapshot: TradeInSnapshotGraph,
  categoryCode: string,
  modelCode: string,
  answers: Record<string, string>,
  questionFilter?: (question: TradeInSnapshotQuestion) => boolean,
): TradeInFlowState {
  const category = snapshot.categories.find((item) => item.categoryCode === categoryCode);
  if (!category) {
    return { resolvedAnswers: {}, questions: [], isComplete: false };
  }

  const resolvedAnswers = { ...answers };
  const questions: TradeInVisibleQuestion[] = [];

  for (const question of [...category.questions]
    .filter((item) => item.isEnabled !== false)
    .filter((item) => (questionFilter ? questionFilter(item) : true))
    .sort((left, right) => left.stepIndex - right.stepIndex)) {
    const options = buildQuestionOptions(question, modelCode);
    if (options.length === 0) {
      continue;
    }

    if (options.length === 1) {
      resolvedAnswers[question.code] = options[0]!.code;
      continue;
    }

    const answeredValue = resolvedAnswers[question.code];
    const currentValue = answeredValue && options.some((option) => option.code === answeredValue)
      ? answeredValue
      : "";

    if (!currentValue) {
      delete resolvedAnswers[question.code];
    }

    questions.push({
      code: question.code,
      title: question.title,
      stepIndex: question.stepIndex,
      options,
      value: currentValue,
    });

    if (!currentValue) {
      return { resolvedAnswers, questions, isComplete: false };
    }
  }

  return { resolvedAnswers, questions, isComplete: true };
}

function normalizeBoolAnswer(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  if (value === "True" || value === "true") {
    return "true";
  }
  if (value === "False" || value === "false") {
    return "false";
  }
  return value;
}

function extractGroupOptions(groupPayload: unknown) {
  if (!groupPayload || typeof groupPayload !== "object" || Array.isArray(groupPayload)) {
    return [] as Array<{ code: string; title: string; pricingPayload: Record<string, unknown> }>;
  }

  const vals = Array.isArray((groupPayload as { vals?: unknown[] }).vals)
    ? (groupPayload as { vals: unknown[] }).vals
    : [];

  return vals.map((option) => normalizeOption(option));
}

function parseNumericOptionCode(code: string) {
  const normalized = code.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickClosestOptionCode(
  questionCode: string,
  desiredCode: string | undefined,
  options: Array<{ code: string }>,
) {
  if (options.length === 0) {
    return undefined;
  }

  if (desiredCode && options.some((option) => option.code === desiredCode)) {
    return desiredCode;
  }

  if (questionCode === "cpu") {
    if (desiredCode?.includes("intel")) {
      const intelOption = options.find((option) => option.code.includes("intel"));
      if (intelOption) {
        return intelOption.code;
      }
    }

    if (desiredCode?.startsWith("apple")) {
      const appleOption = options.find((option) => option.code.startsWith("apple"));
      if (appleOption) {
        return appleOption.code;
      }
    }

    const intelOption = options.find((option) => option.code.includes("intel"));
    return intelOption?.code ?? options[0]!.code;
  }

  const desiredNumeric = desiredCode ? parseNumericOptionCode(desiredCode) : null;
  if (desiredNumeric !== null) {
    const numericOptions = options
      .map((option) => ({ option, numericCode: parseNumericOptionCode(option.code) }))
      .filter((item): item is { option: { code: string }; numericCode: number } => item.numericCode !== null)
      .sort((left, right) => {
        const leftDistance = Math.abs(left.numericCode - desiredNumeric);
        const rightDistance = Math.abs(right.numericCode - desiredNumeric);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
        return left.numericCode - right.numericCode;
      });

    if (numericOptions.length > 0) {
      return numericOptions[0]!.option.code;
    }
  }

  return options[0]!.code;
}

async function findMacFallbackQuote(
  snapshot: TradeInSnapshotGraph,
  input: {
    modelCode: string;
    answers: Record<string, string>;
  },
) {
  const model = getTradeInModel(snapshot, "mac", input.modelCode);
  const modelParams = model?.metadata.params;
  const yearOptions = modelParams && typeof modelParams === "object" && !Array.isArray(modelParams)
    ? extractGroupOptions((modelParams as Record<string, unknown>).year)
    : [];

  if (yearOptions.length === 0) {
    return null;
  }

  const selectedYear = input.answers.year;
  const selectedYearNumber = selectedYear ? parseNumericOptionCode(selectedYear) : null;
  const orderedYears = [...new Set(yearOptions.map((option) => option.code))].sort((left, right) => {
    if (left === selectedYear) {
      return -1;
    }
    if (right === selectedYear) {
      return 1;
    }

    const leftNumber = parseNumericOptionCode(left);
    const rightNumber = parseNumericOptionCode(right);
    if (selectedYearNumber !== null && leftNumber !== null && rightNumber !== null) {
      const leftDistance = Math.abs(leftNumber - selectedYearNumber);
      const rightDistance = Math.abs(rightNumber - selectedYearNumber);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
    }

    return left.localeCompare(right, "ru");
  });

  const seenPayloads = new Set<string>();

  for (const year of orderedYears) {
    try {
      const yearScopedParams = await fetchTradeInCategoryParams("mac", {
        models_macbooks: input.modelCode,
        year,
      });
      const scopedModel = yearScopedParams?.[input.modelCode];
      const scopedParams = scopedModel && typeof scopedModel === "object" && !Array.isArray(scopedModel)
        ? ((scopedModel as Record<string, unknown>).params as Record<string, unknown> | undefined) ?? {}
        : {};

      const fallbackPayload: Record<string, string | number | boolean | null | undefined> = {
        models_macbooks: input.modelCode,
        year,
        damaged: input.answers.damaged,
      };

      for (const [groupCode, groupPayload] of Object.entries(scopedParams)) {
        const normalizedGroupCode = String((groupPayload as Record<string, unknown>).group_abbr ?? groupCode);
        if (normalizedGroupCode === "year") {
          continue;
        }

        const options = extractGroupOptions(groupPayload);
        const nextCode = pickClosestOptionCode(normalizedGroupCode, input.answers[normalizedGroupCode], options);
        if (!nextCode) {
          continue;
        }

        fallbackPayload[normalizedGroupCode] = normalizedGroupCode === "is_retina"
          ? normalizeBoolAnswer(nextCode)
          : nextCode;
      }

      const payloadKey = JSON.stringify(fallbackPayload);
      if (seenPayloads.has(payloadKey)) {
        continue;
      }
      seenPayloads.add(payloadKey);

      const candidate = await fetchTradeInBuyoutPrice("mac", fallbackPayload);
      const amount = extractTradeInQuoteAmount(candidate, "mac");
      if (!amount || !Number.isFinite(amount)) {
        continue;
      }

      return {
        amount,
        bonus: Number(candidate.bonus_for_use ?? 0),
        screenFine: Number(candidate.restored_display_iphone_fine ?? 0),
        fallbackYear: year,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function getTradeInCategory(snapshot: TradeInSnapshotGraph, categoryCode: string) {
  return snapshot.categories.find((item) => item.categoryCode === categoryCode) ?? null;
}

function getTradeInModel(snapshot: TradeInSnapshotGraph, categoryCode: string, modelCode: string) {
  return getTradeInCategory(snapshot, categoryCode)?.models.find((item) => item.code === modelCode) ?? null;
}

export function buildTradeInPricingPayload(
  snapshot: TradeInSnapshotGraph,
  input: {
    categoryCode: TradeInSupportedCategory;
    modelCode: string;
    answers: Record<string, string>;
  },
) {
  const model = getTradeInModel(snapshot, input.categoryCode, input.modelCode);
  const modelMetadata = model?.metadata ?? {};
  const answers = input.answers;

  if (input.categoryCode === "iphone") {
    const payload: Record<string, string | undefined> = {
      models_iphones: input.modelCode,
      memory: answers.memory,
      equipment_iphone: "zero",
      restored_display: answers.restored_display,
      exterier_condition: answers.exterier_condition,
      damaged: answers.damaged,
    };
    if (typeof modelMetadata.modelSeries === "string") {
      payload.model_series = modelMetadata.modelSeries;
    }
    return payload;
  }

  if (input.categoryCode === "mac") {
    return {
      models_macbooks: input.modelCode,
      year: answers.year,
      memory: answers.memory,
      inches: answers.inches,
      cpu: answers.cpu,
      touch_bar: answers.touch_bar,
      is_retina: normalizeBoolAnswer(answers.is_retina),
      ram: answers.ram,
      damaged: answers.damaged,
    };
  }

  if (input.categoryCode === "samsung") {
    return {
      vendor: "samsung",
      models_android: input.modelCode,
      memory: answers.memory,
      exterier_condition_android: answers.exterier_condition_android,
    };
  }

  if (input.categoryCode === "ipad") {
    return {
      models_ipads: input.modelCode,
      memory: answers.memory,
      cellular: answers.cellular,
      exterier_condition_ipad: answers.exterier_condition_ipad,
      equipment_ipad: "zero",
    };
  }

  return {
    models_watches: input.modelCode,
    size_mm: answers.size_mm,
    exterier_condition_watches: answers.exterier_condition_watches,
    equipment_watches: "zero",
  };
}

function extractTradeInQuoteAmount(response: Record<string, unknown>, categoryCode: TradeInSupportedCategory) {
  if (typeof response.counted_price === "number") {
    return response.counted_price;
  }
  if (typeof response.counted_price === "string" && response.counted_price.trim()) {
    return Number(response.counted_price);
  }
  if (categoryCode !== "mac") {
    if (typeof response.min_price === "number") {
      return response.min_price;
    }
    if (typeof response.min_price === "string" && response.min_price.trim()) {
      return Number(response.min_price);
    }
    if (typeof response.max_price === "number") {
      return response.max_price;
    }
    if (typeof response.max_price === "string" && response.max_price.trim()) {
      return Number(response.max_price);
    }
  }
  return null;
}

export async function quoteTradeInSelection(
  snapshot: TradeInSnapshotGraph,
  input: {
    categoryCode: TradeInSupportedCategory;
    modelCode: string;
    answers: Record<string, string>;
  },
): Promise<TradeInPriceQuote> {
  const payload = buildTradeInPricingPayload(snapshot, input);
  let initialCandidate: Record<string, unknown> | null = null;
  try {
    initialCandidate = await fetchTradeInBuyoutPrice(input.categoryCode, payload);
  } catch (error) {
    if (input.categoryCode !== "mac") {
      throw error;
    }
  }

  let normalizedCandidates = (initialCandidate ? [initialCandidate] : [])
    .map((candidate) => {
      const amount = extractTradeInQuoteAmount(candidate, input.categoryCode);
      if (!amount || !Number.isFinite(amount)) {
        return null;
      }
      const bonus = Number(candidate.bonus_for_use ?? 0);
      const screenFine = Number(candidate.restored_display_iphone_fine ?? 0);
      return { amount, bonus, screenFine };
    })
    .filter((item): item is { amount: number; bonus: number; screenFine: number } => Boolean(item));

  let fallbackYear: string | null = null;
  if (normalizedCandidates.length === 0 && input.categoryCode === "mac") {
    const fallbackCandidate = await findMacFallbackQuote(snapshot, {
      modelCode: input.modelCode,
      answers: input.answers,
    });

    if (fallbackCandidate) {
      normalizedCandidates = [{
        amount: fallbackCandidate.amount,
        bonus: fallbackCandidate.bonus,
        screenFine: fallbackCandidate.screenFine,
      }];
      fallbackYear = fallbackCandidate.fallbackYear;
    }
  }

  if (normalizedCandidates.length === 0) {
    throw new Error("DamProdam pricing returned no candidates.");
  }

  const minAmount = Math.min(...normalizedCandidates.map((item) => item.amount));
  const maxAmount = Math.max(...normalizedCandidates.map((item) => item.amount));
  const trace = [{ label: fallbackYear ? `Оценка DamProdam по ближайшей конфигурации ${fallbackYear}` : "Оценка DamProdam", amount: minAmount }];

  if (minAmount !== maxAmount) {
    trace.push({ label: `Диапазон сценариев ${minAmount}-${maxAmount} ₽`, amount: maxAmount - minAmount });
  }

  const bonus = normalizedCandidates.find((item) => item.bonus > 0)?.bonus;
  if (bonus) {
    trace.push({ label: "Бонус при покупке у партнера", amount: bonus });
  }

  const screenFine = normalizedCandidates.find((item) => item.screenFine > 0)?.screenFine;
  if (screenFine) {
    trace.push({ label: "Штраф за замененный экран", amount: -screenFine });
  }

  return {
    amount: minAmount,
    minAmount,
    maxAmount,
    trace,
  };
}

export function summarizeTradeInRequestCondition(snapshot: TradeInSnapshotGraph, categoryCode: string, answers: Record<string, string>) {
  const category = getTradeInCategory(snapshot, categoryCode);
  if (!category) {
    return "Оценка по wizard";
  }

  const labels = category.questions
    .filter((question) => ["exterier_condition", "exterier_condition_android", "exterier_condition_ipad", "exterier_condition_watches", "damaged"].includes(question.code))
    .map((question) => question.options.find((option) => option.code === answers[question.code])?.title)
    .filter((title): title is string => Boolean(title));

  return labels[0] ?? "Оценка по wizard";
}

export function summarizeTradeInAnswers(
  snapshot: TradeInSnapshotGraph,
  categoryCode: string,
  answers: Record<string, string>,
) {
  const category = getTradeInCategory(snapshot, categoryCode);
  if (!category) {
    return [] as TradeInAnswerSummaryItem[];
  }

  return [...category.questions]
    .sort((left, right) => left.stepIndex - right.stepIndex)
    .map((question) => {
      const answerCode = answers[question.code];
      if (!answerCode) {
        return null;
      }

      const resolvedOption = question.options.find((option) => option.code === answerCode);
      return {
        code: question.code,
        title: question.title,
        value: resolvedOption?.title ?? answerCode,
      } satisfies TradeInAnswerSummaryItem;
    })
    .filter((item): item is TradeInAnswerSummaryItem => Boolean(item));
}

export function extractTradeInStorage(answers: Record<string, string>, snapshot: TradeInSnapshotGraph, categoryCode: string) {
  const category = getTradeInCategory(snapshot, categoryCode);
  const memoryAnswer = answers.memory;
  if (!category || !memoryAnswer) {
    return null;
  }

  const memoryQuestion = category.questions.find((question) => question.code === "memory");
  return memoryQuestion?.options.find((option) => option.code === memoryAnswer)?.title ?? memoryAnswer;
}