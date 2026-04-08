"use client";

import { useState, useCallback } from "react";

// Data stored in Product.options Json field
export type ProductOptionsData = {
  groups: Array<{ name: string; values: string[] }>;
  allVariants: boolean;
  // When allVariants=true: cartesian product with individual prices
  variants?: Array<{ name: string; price: number }>;
  // When allVariants=false: per-value prices (additive)
  prices?: Record<string, Record<string, number>>;
} | null;

type OptionGroup = { name: string; valuesText: string };

type Props = {
  initial: ProductOptionsData;
  onChange: (data: ProductOptionsData) => void;
};

// Step 1: define groups, Step 2: set prices
export function ProductOptionsEditor({ initial, onChange }: Props) {
  const [step, setStep] = useState<1 | 2>(initial?.groups?.length ? 2 : 1);
  const [groups, setGroups] = useState<OptionGroup[]>(
    initial?.groups?.map((g) => ({
      name: g.name,
      valuesText: g.values.join(", "),
    })) ?? [],
  );
  const [allVariants, setAllVariants] = useState(initial?.allVariants ?? true);
  const [variantPrices, setVariantPrices] = useState<Record<string, number>>(
    () => {
      if (initial?.allVariants && initial?.variants) {
        const map: Record<string, number> = {};
        for (const v of initial.variants) map[v.name] = v.price;
        return map;
      }
      return {};
    },
  );
  const [groupPrices, setGroupPrices] = useState<Record<string, Record<string, number>>>(
    () => initial?.prices ?? {},
  );

  const parsedGroups = groups
    .filter((g) => g.name.trim() && g.valuesText.trim())
    .map((g) => ({
      name: g.name.trim(),
      values: g.valuesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    }));

  // Cartesian product of all group values
  const cartesian = useCallback(
    (groups: Array<{ name: string; values: string[] }>): string[] => {
      if (groups.length === 0) return [];
      return groups.reduce<string[]>(
        (acc, group) => {
          if (acc.length === 0) return group.values;
          const result: string[] = [];
          for (const prev of acc) {
            for (const val of group.values) {
              result.push(`${prev} + ${val}`);
            }
          }
          return result;
        },
        [],
      );
    },
    [],
  );

  function addGroup() {
    setGroups((prev) => [...prev, { name: "", valuesText: "" }]);
  }

  function removeGroup(index: number) {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }

  function updateGroup(index: number, field: "name" | "valuesText", value: string) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  }

  function goToPricing() {
    if (parsedGroups.length === 0) return;
    setStep(2);
  }

  function goToOptions() {
    setStep(1);
  }

  function handleApply() {
    if (parsedGroups.length === 0) {
      onChange(null);
      return;
    }

    const data: ProductOptionsData = {
      groups: parsedGroups,
      allVariants,
    };

    if (allVariants) {
      const combos = cartesian(parsedGroups);
      data.variants = combos.map((name) => ({
        name,
        price: variantPrices[name] ?? 0,
      }));
    } else {
      const prices: Record<string, Record<string, number>> = {};
      for (const group of parsedGroups) {
        prices[group.name] = {};
        for (const val of group.values) {
          prices[group.name]![val] = groupPrices[group.name]?.[val] ?? 0;
        }
      }
      data.prices = prices;
    }

    onChange(data);
  }

  function handleClear() {
    setGroups([]);
    setStep(1);
    setVariantPrices({});
    setGroupPrices({});
    onChange(null);
  }

  const combos = cartesian(parsedGroups);

  // ——— Step 1: Define option groups ———
  if (step === 1) {
    return (
      <div className="opt-editor">
        <div className="opt-editor-header">
          <span style={{ fontWeight: 600 }}>Опции товара</span>
          {groups.length > 0 && (
            <button type="button" className="button button-secondary button-sm" onClick={handleClear}>
              Очистить
            </button>
          )}
        </div>

        {groups.map((g, i) => (
          <div key={i} className="opt-group-card">
            <div className="opt-group-head">
              <input
                type="text"
                placeholder="Название опции (напр. Объем памяти)"
                value={g.name}
                onChange={(e) => updateGroup(i, "name", e.target.value)}
                className="opt-group-name"
              />
              <button type="button" className="opt-group-remove" onClick={() => removeGroup(i)}>✕</button>
            </div>
            <textarea
              placeholder="Значения через запятую (напр. 256 ГБ, 512 ГБ, 1 ТБ)"
              value={g.valuesText}
              onChange={(e) => updateGroup(i, "valuesText", e.target.value)}
              rows={2}
              className="opt-group-values"
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button button-secondary button-sm" onClick={addGroup}>
            + Добавить опцию
          </button>
          {parsedGroups.length > 0 && (
            <button type="button" className="button button-primary button-sm" onClick={goToPricing}>
              Указать цены »
            </button>
          )}
        </div>

        <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
          * Опции товара доступные для выбора, например размеры, цвета и&nbsp;т.п.
        </p>
      </div>
    );
  }

  // ——— Step 2: Set prices ———
  return (
    <div className="opt-editor">
      <div className="opt-editor-header">
        <span style={{ fontWeight: 600 }}>Цены вариантов</span>
      </div>

      <label className="opt-all-toggle">
        <input
          type="checkbox"
          checked={allVariants}
          onChange={(e) => setAllVariants(e.target.checked)}
        />
        <span>Все варианты</span>
      </label>

      {allVariants ? (
        // Cartesian product table
        <div className="opt-variants-table">
          <div className="opt-variants-head">
            <span>Вариант</span>
            <span>Цена</span>
          </div>
          {combos.map((combo) => (
            <div key={combo} className="opt-variant-row">
              <span className="opt-variant-name">{combo}</span>
              <div className="opt-price-cell">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={variantPrices[combo] ?? ""}
                  onChange={(e) =>
                    setVariantPrices((prev) => ({
                      ...prev,
                      [combo]: Number(e.target.value) || 0,
                    }))
                  }
                  className="opt-price-input"
                />
                <span className="opt-currency">RUB</span>
              </div>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
            * Если не указывать опциональную цену, то будет применяться базовая цена товара.
          </p>
        </div>
      ) : (
        // Per-group pricing
        <div className="opt-groups-pricing">
          {parsedGroups.map((group) => (
            <div key={group.name} className="opt-group-pricing">
              <div className="opt-variants-head">
                <span>{group.name}</span>
                <span>Цена</span>
              </div>
              {group.values.map((val) => (
                <div key={val} className="opt-variant-row">
                  <span className="opt-variant-name">{val}</span>
                  <div className="opt-price-cell">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={groupPrices[group.name]?.[val] ?? ""}
                      onChange={(e) =>
                        setGroupPrices((prev) => ({
                          ...prev,
                          [group.name]: {
                            ...prev[group.name],
                            [val]: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className="opt-price-input"
                    />
                    <span className="opt-currency">RUB</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
            * Итоговая цена будет сформирована как сумма выбранных опциональных вариантов.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="button button-secondary button-sm" onClick={goToOptions}>
          « Изменить опции
        </button>
        <button type="button" className="button button-primary button-sm" onClick={handleApply}>
          Применить
        </button>
      </div>
    </div>
  );
}
