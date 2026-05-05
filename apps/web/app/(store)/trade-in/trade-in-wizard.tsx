"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildTradeInFlowState,
  extractTradeInStorage,
  getActiveTradeInCategories,
  getTradeInModels,
  summarizeTradeInAnswers,
  summarizeTradeInRequestCondition,
  type TradeInPriceQuote,
  type TradeInSnapshotGraph,
} from "../../../lib/trade-in-snapshot";
import { addProfileDeviceAction } from "../profile/actions";
import { createUsedDeviceWaitlistEntryAction } from "../waitlist/actions";
import { submitTradeInRequestAction } from "./actions";

type TradeInWizardProps = {
  snapshot: TradeInSnapshotGraph;
  canSaveToProfile: boolean;
  mode?: "trade-in" | "profile" | "waitlist";
  initialProfileDevice?: {
    deviceId: string;
    nickname: string | null;
    categoryCode: string;
    deviceModelCode: string | null;
    answersJson: Record<string, string>;
  } | null;
};

const WAITLIST_COLOR_OPTIONS = [
  "Не важно",
  "Black",
  "White",
  "Silver",
  "Gold",
  "Blue",
  "Pink",
  "Green",
  "Purple",
  "Graphite",
  "Natural",
  "Midnight",
  "Starlight",
  "Space Black",
];

function getWaitlistQuestionCodes(categoryCode: string) {
  switch (categoryCode) {
    case "iphone":
    case "samsung":
      return new Set(["memory"]);
    case "ipad":
      return new Set(["memory", "cellular"]);
    case "apple_watch":
      return new Set(["size_mm"]);
    default:
      return new Set<string>();
  }
}

function extractDisplaySizeFromTitle(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/\b(11|13|40|41|42|44|45|46|49|14|15|16|24)\b/);
  return match?.[1] ?? null;
}

export function TradeInWizard({ snapshot, canSaveToProfile, mode = "trade-in", initialProfileDevice = null }: TradeInWizardProps) {
  const categories = useMemo(() => getActiveTradeInCategories(snapshot), [snapshot]);
  const initialCategoryCode = initialProfileDevice?.categoryCode ?? categories[0]?.categoryCode ?? "";
  const initialModelCode = initialProfileDevice?.deviceModelCode ?? getTradeInModels(snapshot, initialCategoryCode)[0]?.code ?? "";
  const [categoryCode, setCategoryCode] = useState(initialCategoryCode);
  const [modelCode, setModelCode] = useState(initialModelCode);
  const [answers, setAnswers] = useState<Record<string, string>>(initialProfileDevice?.answersJson ?? {});
  const [waitlistColor, setWaitlistColor] = useState("Не важно");
  const [quote, setQuote] = useState<TradeInPriceQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quotePending, setQuotePending] = useState(false);

  const models = useMemo(() => getTradeInModels(snapshot, categoryCode), [snapshot, categoryCode]);
  const waitlistQuestionCodes = useMemo(() => getWaitlistQuestionCodes(categoryCode), [categoryCode]);
  const flowState = useMemo(
    () => buildTradeInFlowState(
      snapshot,
      categoryCode,
      modelCode,
      answers,
      mode === "waitlist" ? (question) => waitlistQuestionCodes.has(question.code) : undefined,
    ),
    [snapshot, categoryCode, modelCode, answers, mode, waitlistQuestionCodes],
  );
  const selectedCategory = categories.find((item) => item.categoryCode === categoryCode) ?? null;
  const selectedModel = models.find((item) => item.code === modelCode) ?? null;
  const storage = extractTradeInStorage(flowState.resolvedAnswers, snapshot, categoryCode);
  const condition = summarizeTradeInRequestCondition(snapshot, categoryCode, flowState.resolvedAnswers);
  const answerSummary = useMemo(
    () => summarizeTradeInAnswers(snapshot, categoryCode, flowState.resolvedAnswers),
    [snapshot, categoryCode, flowState.resolvedAnswers],
  );
  const completedQuestionCount = flowState.questions.filter((question) => Boolean(flowState.resolvedAnswers[question.code])).length;
  const totalQuestionCount = flowState.questions.length;
  const progressPercent = totalQuestionCount > 0 ? Math.round((completedQuestionCount / totalQuestionCount) * 100) : 0;
  const answerSummaryLookup = useMemo(
    () => new Map(answerSummary.map((item) => [item.code, item.value])),
    [answerSummary],
  );
  const waitlistConnectivity = answerSummaryLookup.get("cellular") ?? null;
  const waitlistDisplaySize = answerSummaryLookup.get("size_mm") ?? extractDisplaySizeFromTitle(selectedModel?.title);
  const submitAction = mode === "profile"
    ? addProfileDeviceAction
    : mode === "waitlist"
      ? createUsedDeviceWaitlistEntryAction
      : submitTradeInRequestAction;
  const title = mode === "profile"
    ? "Добавьте устройство в профиль"
    : mode === "waitlist"
      ? "Добавьте устройство в список ожидания"
      : "Пошаговая оценка Trade-in";
  const intro = mode === "profile"
    ? "Выберите устройство и пройдите тот же wizard, что и в trade-in. После расчета оно сохранится в вашем профиле."
    : mode === "waitlist"
      ? "Выберите точную модель и нужные параметры. Когда такой trade-in вариант появится, мы сохраним его в вашем списке ожидания."
      : "Выберите устройство и ответьте на несколько вопросов. Расчет обновится автоматически после заполнения всех шагов.";
  const quoteTitle = mode === "profile" ? "Оценка для профиля" : "Предварительная оценка";
  const submitLabel = mode === "profile"
    ? "Сохранить устройство в профиль"
    : mode === "waitlist"
      ? "Сохранить в список ожидания"
      : "Отправить заявку на Trade-in";

  useEffect(() => {
    const initialCategory = categories[0]?.categoryCode ?? "";
    if (categoryCode && categories.some((item) => item.categoryCode === categoryCode)) {
      return;
    }
    setCategoryCode(initialCategory);
  }, [categories, categoryCode]);

  useEffect(() => {
    const nextModelCode = models[0]?.code ?? "";
    if (modelCode && models.some((item) => item.code === modelCode)) {
      return;
    }
    setModelCode(nextModelCode);
    setAnswers({});
  }, [modelCode, models]);

  useEffect(() => {
    const currentAnswerJson = JSON.stringify(answers);
    const resolvedAnswerJson = JSON.stringify(flowState.resolvedAnswers);
    if (currentAnswerJson !== resolvedAnswerJson) {
      setAnswers(flowState.resolvedAnswers);
    }
  }, [answers, flowState.resolvedAnswers]);

  useEffect(() => {
    if (mode === "waitlist") {
      setQuote(null);
      setQuoteError(null);
      setQuotePending(false);
      return;
    }

    if (!categoryCode || !modelCode || !flowState.isComplete) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const controller = new AbortController();
    setQuotePending(true);
    setQuoteError(null);

    fetch("/api/trade-in/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snapshotVersion: snapshot.version,
        categoryCode,
        modelCode,
        answers: flowState.resolvedAnswers,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(typeof payload?.error === "string" ? payload.error : "Не удалось рассчитать стоимость trade-in.");
        }
        return payload.quote as TradeInPriceQuote;
      })
      .then((nextQuote) => {
        setQuote(nextQuote);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setQuote(null);
        setQuoteError(error instanceof Error ? error.message : "Не удалось рассчитать стоимость trade-in.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setQuotePending(false);
        }
      });

    return () => controller.abort();
  }, [categoryCode, flowState.isComplete, flowState.resolvedAnswers, modelCode, mode, snapshot.version]);

  return (
    <section className="card glass calculator-card">
      <div className="trade-in-wizard-head">
        <div>
          <div className="section-label">Оценка по ProstorTradeInBot</div>
          <h2 className="trade-in-wizard-title">{title}</h2>
          <p className="trade-in-wizard-copy">{intro}</p>
        </div>
        <div className="trade-in-wizard-progress glass-strong">
          <div className="trade-in-wizard-progress-value">{progressPercent}%</div>
          <div className="trade-in-wizard-progress-copy">
            {completedQuestionCount} из {Math.max(totalQuestionCount, 1)} шагов заполнено
          </div>
          <div className="trade-in-wizard-progress-bar">
            <div className="trade-in-wizard-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="trade-in-wizard-summary">
        {selectedCategory ? <span className="pill">{selectedCategory.title}</span> : null}
        {selectedModel ? <span className="pill">{selectedModel.title}</span> : null}
        {storage ? <span className="pill pill-muted">{storage}</span> : null}
        {condition && condition !== "Оценка по wizard" ? <span className="pill pill-muted">{condition}</span> : null}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Категория</span>
          <select
            value={categoryCode}
            onChange={(event) => {
              const nextCategoryCode = event.target.value;
              const nextModelCode = getTradeInModels(snapshot, nextCategoryCode)[0]?.code ?? "";
              setCategoryCode(nextCategoryCode);
              setModelCode(nextModelCode);
              setAnswers({});
            }}
          >
            {categories.map((category) => (
              <option key={category.categoryCode} value={category.categoryCode}>
                {category.title}
              </option>
            ))}
          </select>
        </label>

        <label className="field field-wide">
          <span>Модель</span>
          <select
            value={modelCode}
            onChange={(event) => {
              setModelCode(event.target.value);
              setAnswers({});
            }}
          >
            {models.map((model) => (
              <option key={model.code} value={model.code}>
                {model.title}
              </option>
            ))}
          </select>
        </label>

        {flowState.questions.map((question) => (
          <label key={question.code} className="field field-wide trade-in-question-field">
            <span>
              Шаг {Math.min(question.stepIndex, Math.max(totalQuestionCount, question.stepIndex))}. {question.title}
            </span>
            <select
              value={flowState.resolvedAnswers[question.code] ?? ""}
              onChange={(event) => {
                const nextAnswerCode = event.target.value;
                const nextAnswers: Record<string, string> = {};
                for (const currentQuestion of flowState.questions) {
                  if (currentQuestion.stepIndex < question.stepIndex) {
                    const currentValue = flowState.resolvedAnswers[currentQuestion.code];
                    if (currentValue) {
                      nextAnswers[currentQuestion.code] = currentValue;
                    }
                  }
                }
                if (nextAnswerCode) {
                  nextAnswers[question.code] = nextAnswerCode;
                }
                setAnswers(nextAnswers);
              }}
            >
              <option value="">Выберите вариант</option>
              {question.options.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="result-card glass">
        <div className="section-label">{mode === "waitlist" ? "Что попадет в список ожидания" : quoteTitle}</div>
        {mode === "waitlist" ? (
          <>
            <div className="stat">{selectedModel?.title ?? "Выберите модель"}</div>
            {selectedCategory ? <p><strong>{selectedCategory.title}</strong></p> : null}
            <div className="trade-in-quote-trace">
              {storage ? (
                <div className="trade-in-quote-trace-row">
                  <span>Память</span>
                  <strong>{storage}</strong>
                </div>
              ) : null}
              {waitlistDisplaySize ? (
                <div className="trade-in-quote-trace-row">
                  <span>Размер</span>
                  <strong>{waitlistDisplaySize}</strong>
                </div>
              ) : null}
              {waitlistConnectivity ? (
                <div className="trade-in-quote-trace-row">
                  <span>Связь</span>
                  <strong>{waitlistConnectivity}</strong>
                </div>
              ) : null}
              <div className="trade-in-quote-trace-row">
                <span>Цвет</span>
                <strong>{waitlistColor}</strong>
              </div>
            </div>
            <p>Когда появится подходящий trade-in вариант, он будет привязан к вашему явному запросу, а не к сохраненным устройствам.</p>
          </>
        ) : (
          <>
            <div className="stat">
              {quotePending ? "Считаем..." : quote ? `${quote.amount.toLocaleString("ru-RU")} ₽` : "По запросу"}
            </div>
            {selectedCategory ? <p><strong>{selectedCategory.title}</strong></p> : null}
            {selectedModel ? <p>{selectedModel.title}</p> : null}
            {quote && quote.minAmount !== quote.maxAmount ? (
              <p className="muted">Ориентир: от {quote.minAmount.toLocaleString("ru-RU")} ₽ до {quote.maxAmount.toLocaleString("ru-RU")} ₽</p>
            ) : null}
            {answerSummary.length > 0 ? (
              <div className="trade-in-quote-trace">
                {answerSummary.map((item) => (
                  <div key={item.code} className="trade-in-quote-trace-row">
                    <span>{item.title}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            {quoteError ? <p>{quoteError}</p> : null}
            {!quoteError ? <p>Финальная стоимость зависит от состояния, комплектации и результатов диагностики устройства.</p> : null}
          </>
        )}
      </div>

      <form action={submitAction} className="form-grid">
        <input type="hidden" name="brand" value={selectedCategory?.title ?? ""} />
        <input type="hidden" name="model" value={selectedModel?.title ?? ""} />
        <input type="hidden" name="storage" value={storage ?? ""} />
        <input type="hidden" name="snapshotVersion" value={String(snapshot.version)} />
        <input type="hidden" name="categoryCode" value={categoryCode} />
        <input type="hidden" name="deviceModelCode" value={modelCode} />
        <input type="hidden" name="answersJson" value={JSON.stringify(flowState.resolvedAnswers)} />
        <input type="hidden" name="displaySize" value={waitlistDisplaySize ?? ""} />
        <input type="hidden" name="connectivity" value={waitlistConnectivity ?? ""} />
        {mode === "profile" && initialProfileDevice?.deviceId ? <input type="hidden" name="deviceId" value={initialProfileDevice.deviceId} /> : null}
        {mode !== "waitlist" ? <input type="hidden" name="condition" value={condition} /> : null}
        {mode !== "waitlist" ? <input type="hidden" name="quote" value={String(quote?.amount ?? 0)} /> : null}
        {mode === "profile" ? (
          <label className="field field-wide">
            <span>Название в профиле</span>
            <input name="nickname" type="text" placeholder="Например, Мой основной iPhone" defaultValue={initialProfileDevice?.nickname ?? ""} />
          </label>
        ) : mode === "waitlist" ? (
          <label className="field field-wide">
            <span>Цвет</span>
            <select name="color" value={waitlistColor} onChange={(event) => setWaitlistColor(event.target.value)}>
              {WAITLIST_COLOR_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="field">
              <span>Имя</span>
              <input name="customerName" type="text" placeholder="Как к вам обращаться" required />
            </label>
            <label className="field">
              <span>Телефон</span>
              <input name="phone" type="tel" placeholder="+7 900 000-00-00" required />
            </label>
            <label className="field field-wide">
              <span>Комментарий</span>
              <textarea name="note" rows={4} placeholder="Опишите состояние, комплект и удобное время звонка." />
            </label>
            <label className="field field-wide" style={{ gap: 10 }}>
              <span>Сохранение в профиль</span>
              {canSaveToProfile ? (
                <label className="trade-in-save-toggle">
                  <input
                    type="checkbox"
                    name="saveToProfile"
                    value="1"
                    defaultChecked
                  />
                  <span>Добавить устройство в «Мои устройства» после отправки заявки</span>
                </label>
              ) : (
                <div className="muted">
                  Войдите в профиль, чтобы сохранить это устройство и позже смотреть апгрейды и уведомления.
                </div>
              )}
            </label>
          </>
        )}
        <div className="actions field-wide">
          <button
            className="button button-primary"
            type="submit"
            disabled={quotePending || !flowState.isComplete || (mode !== "waitlist" && !quote)}
          >
            {submitLabel}
          </button>
          {!flowState.isComplete ? (
            <div className="muted">
              {mode === "waitlist"
                ? "Выберите все обязательные параметры, чтобы сохранить точный запрос в список ожидания."
                : "Заполните все шаги, чтобы получить оценку и продолжить."}
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}