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
import { submitTradeInRequestAction } from "./actions";

type TradeInWizardProps = {
  snapshot: TradeInSnapshotGraph;
};

export function TradeInWizard({ snapshot }: TradeInWizardProps) {
  const categories = useMemo(() => getActiveTradeInCategories(snapshot), [snapshot]);
  const [categoryCode, setCategoryCode] = useState(categories[0]?.categoryCode ?? "");
  const [modelCode, setModelCode] = useState(getTradeInModels(snapshot, categories[0]?.categoryCode ?? "")[0]?.code ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<TradeInPriceQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quotePending, setQuotePending] = useState(false);

  const models = useMemo(() => getTradeInModels(snapshot, categoryCode), [snapshot, categoryCode]);
  const flowState = useMemo(() => buildTradeInFlowState(snapshot, categoryCode, modelCode, answers), [snapshot, categoryCode, modelCode, answers]);
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
  }, [categoryCode, flowState.isComplete, flowState.resolvedAnswers, modelCode, snapshot.version]);

  return (
    <section className="card glass calculator-card">
      <div className="trade-in-wizard-head">
        <div>
          <div className="section-label">Оценка по ProstorTradeInBot</div>
          <h2 className="trade-in-wizard-title">Пошаговая оценка Trade-in</h2>
          <p className="trade-in-wizard-copy">
            Выберите устройство и ответьте на несколько вопросов. Расчет обновится автоматически после заполнения всех шагов.
          </p>
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
        <div className="section-label">Предварительная оценка</div>
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
      </div>

      <form action={submitTradeInRequestAction} className="form-grid">
        <input type="hidden" name="brand" value={selectedCategory?.title ?? ""} />
        <input type="hidden" name="model" value={selectedModel?.title ?? ""} />
        <input type="hidden" name="storage" value={storage ?? ""} />
        <input type="hidden" name="condition" value={condition} />
        <input type="hidden" name="snapshotVersion" value={String(snapshot.version)} />
        <input type="hidden" name="categoryCode" value={categoryCode} />
        <input type="hidden" name="deviceModelCode" value={modelCode} />
        <input type="hidden" name="answersJson" value={JSON.stringify(flowState.resolvedAnswers)} />
        <input type="hidden" name="quote" value={String(quote?.amount ?? 0)} />
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
        <div className="actions field-wide">
          <button className="button button-primary" type="submit" disabled={!quote || quotePending || !flowState.isComplete}>
            Отправить заявку на Trade-in
          </button>
          {!flowState.isComplete ? <div className="muted">Заполните все шаги, чтобы получить оценку и отправить заявку.</div> : null}
        </div>
      </form>
    </section>
  );
}