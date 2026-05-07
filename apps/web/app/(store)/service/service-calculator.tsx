"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassSelect } from "../../../components/store/glass-select";
import type { ServiceCatalogEntry } from "../../../lib/service-catalog";
import { submitServiceRequestAction } from "./actions";

type ServiceCalculatorProps = {
  entries: ServiceCatalogEntry[];
  initialCustomerName?: string;
  initialPhone?: string;
};

type SelectOption = {
  slug: string;
  name: string;
  sortOrder: number;
};

function sortByNameAndOrder(left: SelectOption, right: SelectOption) {
  if (left.sortOrder !== right.sortOrder) {
    return right.sortOrder - left.sortOrder;
  }

  return left.name.localeCompare(right.name, "ru");
}

function getBrands(entries: ServiceCatalogEntry[]) {
  return [...new Set(entries.map((item) => item.brand))].sort((left, right) => left.localeCompare(right, "ru"));
}

function getModels(entries: ServiceCatalogEntry[], brand: string) {
  const models = new Map<string, SelectOption>();

  for (const entry of entries) {
    if (entry.brand !== brand) {
      continue;
    }

    const key = `${entry.modelSlug}::${entry.modelName}`;
    if (!models.has(key)) {
      models.set(key, {
        slug: entry.modelSlug,
        name: entry.modelName,
        sortOrder: entry.modelSortOrder,
      });
    }
  }

  return Array.from(models.values()).sort(sortByNameAndOrder);
}

function getServices(entries: ServiceCatalogEntry[], brand: string, modelSlug: string) {
  const services = new Map<string, SelectOption>();

  for (const entry of entries) {
    if (entry.brand !== brand || entry.modelSlug !== modelSlug) {
      continue;
    }

    if (!services.has(entry.serviceSlug)) {
      services.set(entry.serviceSlug, {
        slug: entry.serviceSlug,
        name: entry.serviceName,
        sortOrder: entry.serviceSortOrder,
      });
    }
  }

  return Array.from(services.values()).sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name, "ru");
  });
}

function getVariants(entries: ServiceCatalogEntry[], brand: string, modelSlug: string, serviceSlug: string) {
  return entries
    .filter((entry) => entry.brand === brand && entry.modelSlug === modelSlug && entry.serviceSlug === serviceSlug)
    .sort((left, right) => {
      if (left.variantSortOrder !== right.variantSortOrder) {
        return left.variantSortOrder - right.variantSortOrder;
      }

      return left.variantName.localeCompare(right.variantName, "ru");
    });
}

export function ServiceCalculator({ entries, initialCustomerName = "", initialPhone = "" }: ServiceCalculatorProps) {
  const brands = useMemo(() => getBrands(entries), [entries]);
  const [brand, setBrand] = useState(brands[0] ?? "");
  const [modelSlug, setModelSlug] = useState(getModels(entries, brands[0] ?? "")[0]?.slug ?? "");
  const [serviceSlug, setServiceSlug] = useState(
    getServices(entries, brands[0] ?? "", getModels(entries, brands[0] ?? "")[0]?.slug ?? "")[0]?.slug ?? "",
  );
  const [variantId, setVariantId] = useState(
    getVariants(
      entries,
      brands[0] ?? "",
      getModels(entries, brands[0] ?? "")[0]?.slug ?? "",
      getServices(entries, brands[0] ?? "", getModels(entries, brands[0] ?? "")[0]?.slug ?? "")[0]?.slug ?? "",
    )[0]?.variantId ?? "",
  );

  const models = useMemo(() => getModels(entries, brand), [entries, brand]);
  const services = useMemo(() => getServices(entries, brand, modelSlug), [entries, brand, modelSlug]);
  const variants = useMemo(() => getVariants(entries, brand, modelSlug, serviceSlug), [entries, brand, modelSlug, serviceSlug]);

  useEffect(() => {
    if (!brands.includes(brand)) {
      setBrand(brands[0] ?? "");
    }
  }, [brand, brands]);

  useEffect(() => {
    if (!models.some((item) => item.slug === modelSlug)) {
      setModelSlug(models[0]?.slug ?? "");
    }
  }, [modelSlug, models]);

  useEffect(() => {
    if (!services.some((item) => item.slug === serviceSlug)) {
      setServiceSlug(services[0]?.slug ?? "");
    }
  }, [serviceSlug, services]);

  useEffect(() => {
    if (!variants.some((item) => item.variantId === variantId)) {
      setVariantId(variants[0]?.variantId ?? "");
    }
  }, [variantId, variants]);

  const selectedModel = models.find((item) => item.slug === modelSlug) ?? null;
  const selectedService = services.find((item) => item.slug === serviceSlug) ?? null;
  const selectedVariant = variants.find((item) => item.variantId === variantId) ?? null;
  const quote = selectedVariant?.totalPrice ?? null;
  const availableColors = Array.isArray(selectedVariant?.metadata.colors)
    ? (selectedVariant?.metadata.colors as string[])
    : [];

  if (entries.length === 0) {
    return (
      <section className="card glass calculator-card">
        <div className="section-label">Быстрый расчет ремонта</div>
        <p>Прайс сервиса пока не загружен. Обновите данные в админке и повторите расчет.</p>
      </section>
    );
  }

  return (
    <section className="card glass calculator-card">
      <div className="section-label">Быстрый расчет ремонта</div>
      <div className="form-grid">
        <label className="field">
          <span>Бренд</span>
          <GlassSelect
            value={brand}
            onChange={(nextBrand) => {
              const nextModel = getModels(entries, nextBrand)[0]?.slug ?? "";
              const nextService = getServices(entries, nextBrand, nextModel)[0]?.slug ?? "";
              setBrand(nextBrand);
              setModelSlug(nextModel);
              setServiceSlug(nextService);
              setVariantId(getVariants(entries, nextBrand, nextModel, nextService)[0]?.variantId ?? "");
            }}
            options={brands.map((item) => ({ value: item, label: item }))}
          />
        </label>

        <label className="field">
          <span>Модель</span>
          <GlassSelect
            value={modelSlug}
            onChange={(nextModelSlug) => {
              const nextService = getServices(entries, brand, nextModelSlug)[0]?.slug ?? "";
              setModelSlug(nextModelSlug);
              setServiceSlug(nextService);
              setVariantId(getVariants(entries, brand, nextModelSlug, nextService)[0]?.variantId ?? "");
            }}
            options={models.map((item) => ({ value: item.slug, label: item.name }))}
          />
        </label>

        <label className="field field-wide">
          <span>Услуга</span>
          <GlassSelect
            value={serviceSlug}
            onChange={(nextServiceSlug) => {
              setServiceSlug(nextServiceSlug);
              setVariantId(getVariants(entries, brand, modelSlug, nextServiceSlug)[0]?.variantId ?? "");
            }}
            options={services.map((item) => ({ value: item.slug, label: item.name }))}
          />
        </label>

        <label className="field field-wide">
          <span>Вариант запчасти</span>
          <GlassSelect
            value={variantId}
            onChange={setVariantId}
            options={variants.map((item) => ({
              value: item.variantId,
              label: item.variantName,
            }))}
          />
        </label>
      </div>

      <div className="result-card glass">
        <div className="section-label">Стоимость ремонта</div>
        <div className="stat">{quote ? `${quote.toLocaleString("ru-RU")} ₽` : "По запросу"}</div>
        {selectedService ? <p><strong>{selectedService.name}</strong></p> : null}
        {selectedVariant ? <p>{selectedVariant.variantDescription}</p> : null}
        {availableColors.length > 0 ? <p>Доступные цвета: {availableColors.join(", ")}.</p> : null}
        <p>
          Точная стоимость может отличаться после диагностики устройства.
        </p>
      </div>

      <form action={submitServiceRequestAction} className="form-grid">
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="model" value={selectedModel?.name ?? ""} />
        <input type="hidden" name="repairType" value={selectedService?.name ?? ""} />
        <input type="hidden" name="serviceSlug" value={selectedService?.slug ?? ""} />
        <input type="hidden" name="variantId" value={selectedVariant?.variantId ?? ""} />
        <input type="hidden" name="variantName" value={selectedVariant?.variantName ?? ""} />
        <input type="hidden" name="variantDescription" value={selectedVariant?.variantDescription ?? ""} />
        <input type="hidden" name="partPrice" value={String(selectedVariant?.partPrice ?? 0)} />
        <input type="hidden" name="laborPrice" value={String(selectedVariant?.laborPrice ?? 0)} />
        <input type="hidden" name="currency" value={selectedVariant?.currency ?? "RUB"} />
        <input type="hidden" name="quote" value={String(quote ?? 0)} />
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
          <textarea name="note" rows={4} placeholder="Опишите проблему, срочность и удобное время связи." />
        </label>
        <div className="actions field-wide">
          <button className="button button-primary" type="submit" disabled={!selectedVariant}>
            Отправить заявку на ремонт
          </button>
        </div>
      </form>
    </section>
  );
}