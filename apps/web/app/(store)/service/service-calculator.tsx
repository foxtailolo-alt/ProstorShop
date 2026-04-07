"use client";

import { useMemo, useState } from "react";
import type { ServicePriceRow } from "@prostor/core";
import { submitServiceRequestAction } from "./actions";

type ServiceCalculatorProps = {
  rows: ServicePriceRow[];
};

function getBrands(rows: ServicePriceRow[]) {
  return [...new Set(rows.map((item) => item.brand))];
}

function getModels(rows: ServicePriceRow[], brand: string) {
  return [...new Set(rows.filter((item) => item.brand === brand).map((item) => item.model))];
}

function getRepairTypes(rows: ServicePriceRow[], brand: string, model: string) {
  return [
    ...new Set(rows.filter((item) => item.brand === brand && item.model === model).map((item) => item.repairType)),
  ];
}

function calculateQuote(rows: ServicePriceRow[], input: { brand: string; model: string; repairType: string }) {
  return (
    rows.find(
      (item) =>
        item.brand === input.brand && item.model === input.model && item.repairType === input.repairType,
    )?.price ?? null
  );
}

export function ServiceCalculator({ rows }: ServiceCalculatorProps) {
  const brands = useMemo(() => getBrands(rows), [rows]);
  const [brand, setBrand] = useState(brands[0] ?? "");
  const [model, setModel] = useState(getModels(rows, brands[0] ?? "")[0] ?? "");
  const [repairType, setRepairType] = useState(
    getRepairTypes(rows, brands[0] ?? "", getModels(rows, brands[0] ?? "")[0] ?? "")[0] ?? "",
  );

  const models = useMemo(() => getModels(rows, brand), [rows, brand]);
  const repairTypes = useMemo(() => getRepairTypes(rows, brand, model), [rows, brand, model]);

  const quote = calculateQuote(rows, { brand, model, repairType });

  return (
    <section className="card glass calculator-card">
      <div className="section-label">Быстрый расчет ремонта</div>
      <div className="form-grid">
        <label className="field">
          <span>Бренд</span>
          <select
            value={brand}
            onChange={(event) => {
              const nextBrand = event.target.value;
              const nextModel = getModels(rows, nextBrand)[0] ?? "";
              setBrand(nextBrand);
              setModel(nextModel);
              setRepairType(getRepairTypes(rows, nextBrand, nextModel)[0] ?? "");
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
              setRepairType(getRepairTypes(rows, brand, nextModel)[0] ?? "");
            }}
          >
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field field-wide">
          <span>Тип ремонта</span>
          <select value={repairType} onChange={(event) => setRepairType(event.target.value)}>
            {repairTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="result-card glass">
        <div className="section-label">Стоимость ремонта</div>
        <div className="stat">{quote ? `${quote.toLocaleString("ru-RU")} ₽` : "По запросу"}</div>
        <p>
          Точная стоимость может отличаться после диагностики устройства.
        </p>
      </div>

      <form action={submitServiceRequestAction} className="form-grid">
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="model" value={model} />
        <input type="hidden" name="repairType" value={repairType} />
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
          <textarea name="note" rows={4} placeholder="Опишите проблему, срочность и удобное время связи." />
        </label>
        <div className="actions field-wide">
          <button className="button button-primary" type="submit">
            Отправить заявку на ремонт
          </button>
        </div>
      </form>
    </section>
  );
}