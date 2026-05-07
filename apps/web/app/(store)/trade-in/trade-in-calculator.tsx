"use client";

import { useMemo, useState } from "react";
import { tradeInConditions, type TradeInRule } from "@prostor/core";
import { GlassSelect } from "../../../components/store/glass-select";
import { submitTradeInRequestAction } from "./actions";

type AppliedPromo = {
  id: string;
  code: string;
  discountKind: string;
  amount: number;
  percent: number;
  rewardDescription: string | null;
};

type TradeInCalculatorProps = {
  rules: TradeInRule[];
  initialCustomerName?: string;
  initialPhone?: string;
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

export function TradeInCalculator({ rules, initialCustomerName = "", initialPhone = "" }: TradeInCalculatorProps) {
  const brands = useMemo(() => getBrands(rules), [rules]);
  const [brand, setBrand] = useState(brands[0] ?? "");
  const [model, setModel] = useState(getModels(rules, brands[0] ?? "")[0] ?? "");
  const [storage, setStorage] = useState(
    getStorageOptions(rules, brands[0] ?? "", getModels(rules, brands[0] ?? "")[0] ?? "")[0] ?? "",
  );
  const [condition, setCondition] = useState<(typeof tradeInConditions)[number]["value"]>("good");
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const models = useMemo(() => getModels(rules, brand), [rules, brand]);
  const storageOptions = useMemo(() => getStorageOptions(rules, brand, model), [rules, brand, model]);

  const baseQuote = calculateQuote(rules, { brand, model, storage, condition });
  const promoBonus = appliedPromo
    ? appliedPromo.discountKind === "flat"
      ? appliedPromo.amount
      : appliedPromo.discountKind === "percent" && baseQuote
        ? Math.round((baseQuote * appliedPromo.percent) / 100)
        : 0
    : 0;
  const finalQuote = baseQuote ? baseQuote + promoBonus : null;

  async function handleApplyPromo() {
    setPromoLoading(true);
    setPromoError(null);
    try {
      const response = await fetch("/api/trade-in/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Промокод не подошёл.");
      }
      setAppliedPromo(payload.promoCode);
    } catch (error) {
      setPromoError(error instanceof Error ? error.message : "Не удалось применить промокод.");
      setAppliedPromo(null);
    } finally {
      setPromoLoading(false);
    }
  }

  function clearPromo() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  }

  return (
    <section className="card glass calculator-card">
      <div className="section-label">Мгновенный расчет</div>
      <div className="form-grid">
        <label className="field">
          <span>Бренд</span>
          <GlassSelect
            value={brand}
            onChange={(nextBrand) => {
              const nextModel = getModels(rules, nextBrand)[0] ?? "";
              setBrand(nextBrand);
              setModel(nextModel);
              setStorage(getStorageOptions(rules, nextBrand, nextModel)[0] ?? "");
            }}
            options={brands.map((item) => ({ value: item, label: item }))}
          />
        </label>

        <label className="field">
          <span>Модель</span>
          <GlassSelect
            value={model}
            onChange={(nextModel) => {
              setModel(nextModel);
              setStorage(getStorageOptions(rules, brand, nextModel)[0] ?? "");
            }}
            options={models.map((item) => ({ value: item, label: item }))}
          />
        </label>

        <label className="field">
          <span>Память</span>
          <GlassSelect
            value={storage}
            onChange={setStorage}
            options={storageOptions.map((item) => ({ value: item, label: item }))}
          />
        </label>

        <label className="field">
          <span>Состояние</span>
          <GlassSelect
            value={condition}
            onChange={(nextCondition) => setCondition(nextCondition as typeof condition)}
            options={tradeInConditions.map((item) => ({ value: item.value, label: item.label }))}
          />
        </label>
      </div>

      <div className="result-card glass">
        <div className="section-label">Предварительная оценка</div>
        <div className="stat">{finalQuote ? `${finalQuote.toLocaleString("ru-RU")} ₽` : "По запросу"}</div>
        {appliedPromo && promoBonus > 0 ? (
          <p className="muted">
            Базовая: {baseQuote?.toLocaleString("ru-RU")} ₽ • Промокод {appliedPromo.code}: +{promoBonus.toLocaleString("ru-RU")} ₽
          </p>
        ) : null}
        <p>
          Финальная стоимость зависит от внешнего состояния и комплектации устройства.
        </p>

        <div className="trade-in-promo" style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div className="section-label">Промокод Trade-in</div>
          {appliedPromo ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{appliedPromo.code}</strong>
              {appliedPromo.rewardDescription ? <span className="muted">{appliedPromo.rewardDescription}</span> : null}
              <button type="button" className="button button-secondary button-sm" onClick={clearPromo}>Снять</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                placeholder="Введите код"
                style={{ flex: 1, minWidth: 180 }}
              />
              <button
                type="button"
                className="button button-secondary button-sm"
                disabled={promoLoading || !promoInput.trim()}
                onClick={handleApplyPromo}
              >
                {promoLoading ? "Проверяем…" : "Применить"}
              </button>
            </div>
          )}
          {promoError ? <span className="muted" style={{ color: "#c9534f" }}>{promoError}</span> : null}
        </div>
      </div>

      <form action={submitTradeInRequestAction} className="form-grid">
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="model" value={model} />
        <input type="hidden" name="storage" value={storage} />
        <input type="hidden" name="condition" value={condition} />
        <input type="hidden" name="quote" value={String(finalQuote ?? 0)} />
        <input type="hidden" name="baseQuote" value={String(baseQuote ?? 0)} />
        <input type="hidden" name="promoCodeId" value={appliedPromo?.id ?? ""} />
        <input type="hidden" name="promoBonus" value={String(promoBonus)} />
        <label className="field">
          <span>Имя</span>
          <input name="customerName" type="text" placeholder="Как к вам обращаться" defaultValue={initialCustomerName} required />
        </label>
        <label className="field">
          <span>Телефон</span>
          <input name="phone" type="tel" placeholder="+7 900 000-00-00" defaultValue={initialPhone} required />
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