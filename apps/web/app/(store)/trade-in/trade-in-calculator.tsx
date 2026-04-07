"use client";

import { useMemo, useState } from "react";
import { tradeInConditions, type TradeInRule } from "@prostor/core";
import { submitTradeInRequestAction } from "./actions";

type TradeInCalculatorProps = {
  rules: TradeInRule[];
};

function getBrands(rules: TradeInRule[]) {
  return [...new Set(rules.map((item) => item.brand))];
}

function getModels(rules: TradeInRule[], brand: string) {
  return [...new Set(rules.filter((item) => item.brand === brand).map((item) => item.model))];
}

function getStorageOptions(rules: TradeInRule[], brand: string, model: string) {
  return [
    ...new Set(
      rules
        .filter((item) => item.brand === brand && item.model === model)
        .map((item) => item.storage)
        .filter((item): item is string => Boolean(item)),
    ),
  ];
}

function calculateQuote(rules: TradeInRule[], input: { brand: string; model: string; storage?: string; condition: TradeInRule["condition"] }) {
  return (
    rules.find(
      (item) =>
        item.brand === input.brand &&
        item.model === input.model &&
        item.storage === input.storage &&
        item.condition === input.condition,
    )?.price ?? null
  );
}

export function TradeInCalculator({ rules }: TradeInCalculatorProps) {
  const brands = useMemo(() => getBrands(rules), [rules]);
  const [brand, setBrand] = useState(brands[0] ?? "");
  const [model, setModel] = useState(getModels(rules, brands[0] ?? "")[0] ?? "");
  const [storage, setStorage] = useState(
    getStorageOptions(rules, brands[0] ?? "", getModels(rules, brands[0] ?? "")[0] ?? "")[0] ?? "",
  );
  const [condition, setCondition] = useState<(typeof tradeInConditions)[number]["value"]>("good");

  const models = useMemo(() => getModels(rules, brand), [rules, brand]);
  const storageOptions = useMemo(() => getStorageOptions(rules, brand, model), [rules, brand, model]);

  const quote = calculateQuote(rules, { brand, model, storage, condition });

  return (
    <section className="card glass calculator-card">
      <div className="section-label">Мгновенный расчет</div>
      <div className="form-grid">
        <label className="field">
          <span>Бренд</span>
          <select
            value={brand}
            onChange={(event) => {
              const nextBrand = event.target.value;
              const nextModel = getModels(rules, nextBrand)[0] ?? "";
              setBrand(nextBrand);
              setModel(nextModel);
              setStorage(getStorageOptions(rules, nextBrand, nextModel)[0] ?? "");
            }}
          >
            {brands.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Модель</span>
          <select
            value={model}
            onChange={(event) => {
              const nextModel = event.target.value;
              setModel(nextModel);
              setStorage(getStorageOptions(rules, brand, nextModel)[0] ?? "");
            }}
          >
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Память</span>
          <select value={storage} onChange={(event) => setStorage(event.target.value)}>
            {storageOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Состояние</span>
          <select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}>
            {tradeInConditions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="result-card glass">
        <div className="section-label">Предварительная оценка</div>
        <div className="stat">{quote ? `${quote.toLocaleString("ru-RU")} ₽` : "По запросу"}</div>
        <p>
          Финальная стоимость зависит от внешнего состояния и комплектации устройства.
        </p>
      </div>

      <form action={submitTradeInRequestAction} className="form-grid">
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="model" value={model} />
        <input type="hidden" name="storage" value={storage} />
        <input type="hidden" name="condition" value={condition} />
        <input type="hidden" name="quote" value={String(quote ?? 0)} />
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
          <button className="button button-primary" type="submit">
            Отправить заявку на Trade-in
          </button>
        </div>
      </form>
    </section>
  );
}