import Link from "next/link";
import {
  buildFlatCategoryOptions,
  findNodeBySlug,
  getCategoryPath,
  getAllCategorySlugs,
  loadCategoryTree,
} from "../../../../lib/data/catalog";
import {
  getCompetitorPriceSyncRun,
  getCompetitorSyncCategoryProgress,
  listCompetitorPriceSyncRuns,
} from "../../../../lib/data/pricing";
import {
  COMPETITOR_SYNC_SCOPE_DEFINITIONS,
  getCompetitorSyncScopeDefinition,
} from "../../../../lib/competitor-sync-scopes";
import { CompetitorSyncProgressModal } from "../../../../components/admin/competitor-sync-progress-modal";
import {
  applyCompetitorPriceReviewRowAction,
  applyCompetitorPriceSyncRunAction,
  runCompetitorPriceSyncAction,
  updateCompetitorPriceReviewRowAction,
} from "./actions";
import { PendingSubmitButton } from "../../../../components/admin/pending-submit-button";

type AdminCompetitorPricingPageProps = {
  searchParams: Promise<{
    run?: string;
    category?: string;
  }>;
};

type ProductOptionsData = {
  groups?: Array<{ name: string; values: string[] }>;
  variants?: Array<{ name: string; price: number }>;
};

function parseOptionsData(value: unknown): ProductOptionsData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as ProductOptionsData;
}

function formatOptionsSummary(value: unknown) {
  const options = parseOptionsData(value);

  if (!options) {
    return "Нет";
  }

  const groups = options.groups?.map((group) => `${group.name}: ${group.values.join(", ")}`).join("; ") ?? "Нет";
  const variants = options.variants?.length ?? 0;
  return `${groups} • вариантов: ${variants}`;
}

function renderOptionsDetails(value: unknown, title: string, expandedByDefault = false) {
  const options = parseOptionsData(value);

  if (!options) {
    return <span className="muted">Нет</span>;
  }

  const groups = options.groups ?? [];
  const variants = options.variants ?? [];

  return (
    <details className="competitor-sync-options-block" open={expandedByDefault}>
      <summary>
        <span>{title}</span>
        <span className="muted">{groups.length} групп • {variants.length} вариантов</span>
      </summary>
      <div className="competitor-sync-options-groups">
        {groups.map((group) => (
          <div key={group.name} className="competitor-sync-group-card">
            <div className="competitor-sync-group-title">{group.name}</div>
            <div className="competitor-sync-group-values">
              {group.values.map((groupValue) => (
                <span key={`${group.name}-${groupValue}`} className="pill pill-compact pill-muted">
                  {groupValue}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="competitor-sync-variants-list">
        {variants.length === 0 ? <div className="muted">Варианты не найдены.</div> : null}
        {variants.map((variant) => (
          <div key={`${title}-${variant.name}`} className="competitor-sync-variant-row">
            <span>{variant.name}</span>
            <strong>{Number(variant.price).toLocaleString("ru-RU")} ₽</strong>
          </div>
        ))}
      </div>
    </details>
  );
}

function renderEditableVariants(value: unknown) {
  const options = parseOptionsData(value);

  if (!options?.variants?.length) {
    return <div className="muted">Варианты для редактирования отсутствуют.</div>;
  }

  return (
    <div className="competitor-sync-options-block">
      <div className="competitor-sync-options-editor-head">
        <span>Новые варианты</span>
        <span className="muted">{options.variants.length} вариантов</span>
      </div>
      <div className="competitor-sync-variants-list">
        {options.variants.map((variant) => (
          <div key={`edit-${variant.name}`} className="competitor-sync-variant-row competitor-sync-variant-row-editable">
            <span>{variant.name}</span>
            <input type="hidden" name="variantName" value={variant.name} />
            <input
              type="number"
              name="variantPrice"
              defaultValue={Number(variant.price)}
              min={1}
              step={100}
              className="field competitor-sync-variant-input"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function AdminCompetitorPricingPage({ searchParams }: AdminCompetitorPricingPageProps) {
  const params = await searchParams;
  const selectedCategorySlug = params.category?.trim() ?? "";
  const [runs, categoryTree] = await Promise.all([
    listCompetitorPriceSyncRuns(),
    loadCategoryTree(),
  ]);
  const selectedRunId = params.run ?? runs[0]?.id ?? null;
  const [selectedRun, categoryProgress] = await Promise.all([
    getCompetitorPriceSyncRun(selectedRunId),
    getCompetitorSyncCategoryProgress(selectedRunId),
  ]);
  const presentCategorySlugs = new Set(selectedRun?.rows.map((row) => row.product.category.slug) ?? []);
  const categoryOptions = buildFlatCategoryOptions(categoryTree).filter((option) => presentCategorySlugs.has(option.slug));
  const selectedCategoryNode = selectedCategorySlug ? findNodeBySlug(categoryTree, selectedCategorySlug) : null;
  const allowedCategorySlugs = selectedCategoryNode ? new Set(getAllCategorySlugs([selectedCategoryNode])) : null;
  const filteredRows = selectedRun?.rows.filter((row) => !allowedCategorySlugs || allowedCategorySlugs.has(row.product.category.slug)) ?? [];
  const pendingRows = filteredRows.filter((row) => row.status === "pending");
  const categoryLabelBySlug = new Map(categoryOptions.map((option) => [option.slug, option.label]));
  const selectedCategoryLabel = selectedCategorySlug ? categoryLabelBySlug.get(selectedCategorySlug) ?? selectedCategorySlug : null;
  const selectedScope = getCompetitorSyncScopeDefinition(selectedRun?.scope);
  const recentRuns = runs.slice(0, 3);
  const olderRuns = runs.slice(3);
  const progressRowsTotal = categoryProgress.reduce((sum, item) => sum + item.totalCount, 0);
  const progressRowsProcessed = categoryProgress.reduce((sum, item) => sum + item.processedCount, 0);
  const progressCategoryItems: Array<{
    label: string;
    totalCount: number;
    processedCount: number;
    status: "pending" | "in-progress" | "completed";
  }> = categoryProgress.map((item) => ({
    ...item,
    label: getCategoryPath(categoryTree, item.categorySlug).map((node) => node.name).join(" / ") || item.categoryName,
  }));

  return (
    <main>
      {selectedRun ? (
        <CompetitorSyncProgressModal
          runId={selectedRun.id}
          isRunning={selectedRun.status === "running"}
          scopeLabel={selectedScope.label}
          note={selectedRun.note}
          processedRows={progressRowsProcessed}
          totalRows={progressRowsTotal}
          categoryProgress={progressCategoryItems}
        />
      ) : null}

      <section className="hero glass">
        <div className="section-label">Цены конкурентов</div>
        <h1>One-click обзор цен `resale52.ru` для Apple и Samsung.</h1>
        <p>
          Система собирает цены и опции с карточек конкурента, готовит review-first пакет,
          а применение происходит отдельным действием только после проверки в админке.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">Новый sync run</div>
        <form action={runCompetitorPriceSyncAction} className="grid">
          <div className="muted">
            Источник: `resale52.ru`, правило цены: +2000 и окончание на 700 ₽.
          </div>
          <label className="field competitor-sync-filter-field">
            <span>Категория запуска</span>
            <select name="scope" defaultValue="all">
              {COMPETITOR_SYNC_SCOPE_DEFINITIONS.map((scope) => (
                <option key={scope.key} value={scope.key}>
                  {scope.label}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="button button-primary" type="submit">
              Запустить сбор цен
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }} className="grid grid-2">
        <article className="card glass">
          <div className="section-label">Последние sync run</div>
          <div className="grid">
            {runs.length === 0 ? <p>Запусков пока не было.</p> : null}
            {recentRuns.map((run) => (
              <Link
                key={run.id}
                href={`/admin/competitor-pricing?run=${encodeURIComponent(run.id)}${selectedCategorySlug ? `&category=${encodeURIComponent(selectedCategorySlug)}` : ""}` as "/"}
                className="pill"
              >
                {run.createdAt.toLocaleString("ru-RU")} • {run.status} • {run._count.rows} строк • match {run.matchedCount}/{run.unmatchedCount}
              </Link>
            ))}
            {olderRuns.length > 0 ? (
              <details className="competitor-sync-history-details">
                <summary>Еще {olderRuns.length} запусков</summary>
                <div className="grid" style={{ marginTop: 12 }}>
                  {olderRuns.map((run) => (
                    <Link
                      key={run.id}
                      href={`/admin/competitor-pricing?run=${encodeURIComponent(run.id)}${selectedCategorySlug ? `&category=${encodeURIComponent(selectedCategorySlug)}` : ""}` as "/"}
                      className="pill"
                    >
                      {run.createdAt.toLocaleString("ru-RU")} • {run.status} • {run._count.rows} строк • match {run.matchedCount}/{run.unmatchedCount}
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </article>
        <article className="card glass">
          <div className="section-label">Выбранный запуск</div>
          {selectedRun ? (
            <>
              <div className="stat">{filteredRows.length}</div>
              <p>
                Pending: {pendingRows.length} • status: {selectedRun.status}
              </p>
              <div className="muted">Scope запуска: {selectedScope.label}</div>
              {selectedCategoryLabel ? <div className="muted">Фильтр категории: {selectedCategoryLabel}</div> : null}
              {selectedRun.note ? <div className="muted">{selectedRun.note}</div> : null}
              {pendingRows.length > 0 ? (
                <form action={applyCompetitorPriceSyncRunAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="runId" value={selectedRun.id} />
                  <button className="button button-primary" type="submit">
                    Применить pending строки
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <p>Выберите запуск, чтобы посмотреть review rows.</p>
          )}
        </article>
      </section>

      {selectedRun ? (
        <section style={{ marginTop: 18 }} className="card glass">
          <div className="competitor-sync-review-header">
            <div>
              <div className="section-label">Review rows</div>
              <div className="muted">Сначала выберите нашу категорию, затем редактируйте цену и применяйте только нужные позиции.</div>
            </div>
            <form action="/admin/competitor-pricing" method="get" className="competitor-sync-filter-form">
              <input type="hidden" name="run" value={selectedRun.id} />
              <label className="field competitor-sync-filter-field">
                <span>Наша категория</span>
                <select name="category" defaultValue={selectedCategorySlug}>
                  <option value="">Все категории</option>
                  {categoryOptions.map((option) => (
                    <option key={option.slug} value={option.slug}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="actions">
                <button className="button button-secondary button-sm" type="submit">
                  Применить фильтр
                </button>
              </div>
            </form>
          </div>

          <div className="competitor-sync-review-list">
            {filteredRows.length === 0 ? (
              <div className="muted">По выбранной категории строк нет.</div>
            ) : null}
            {filteredRows.map((row) => (
              <article key={row.id} className="competitor-sync-card">
                <div className="competitor-sync-card-head">
                  <div>
                    <h3>{row.product.name}</h3>
                    <div className="muted">SKU {row.product.sku}</div>
                    <div className="muted">{categoryLabelBySlug.get(row.product.category.slug) ?? row.product.category.name}</div>
                    {row.competitorUrl ? (
                      <a href={row.competitorUrl} target="_blank" rel="noreferrer" className="muted competitor-sync-link">
                        Карточка конкурента
                      </a>
                    ) : null}
                  </div>
                  <div className="competitor-sync-status-wrap">
                    <span className={`pill pill-compact ${row.status === "pending" ? "" : "pill-muted"}`}>
                      {row.status}
                    </span>
                    <span className="pill pill-compact pill-muted">
                      {row.matchMethod} / {row.matchConfidence}
                    </span>
                  </div>
                </div>

                <div className="competitor-sync-card-grid">
                  <section className="competitor-sync-panel">
                    <div className="competitor-sync-panel-title">Цены</div>
                    <div className="competitor-sync-price-list">
                      <div className="competitor-sync-price-row"><span>Текущая</span><strong>{Number(row.currentBasePrice).toLocaleString("ru-RU")} ₽</strong></div>
                      <div className="competitor-sync-price-row"><span>У конкурента</span><strong>{Number(row.competitorBasePrice).toLocaleString("ru-RU")} ₽</strong></div>
                    </div>

                    {row.status === "pending" ? (
                      <form action={updateCompetitorPriceReviewRowAction} className="competitor-sync-edit-form">
                        <input type="hidden" name="rowId" value={row.id} />
                        <input type="hidden" name="runId" value={selectedRun.id} />
                        <input type="hidden" name="category" value={selectedCategorySlug} />
                        <label className="field">
                          <span>Новая наша цена</span>
                          <input
                            type="number"
                            name="proposedBasePrice"
                            defaultValue={Number(row.proposedBasePrice)}
                            min={1}
                            step={100}
                          />
                        </label>
                        {renderEditableVariants(row.proposedOptions)}
                        <button className="button button-secondary button-sm" type="submit">
                          Сохранить цену и варианты
                        </button>
                      </form>
                    ) : (
                      <div className="competitor-sync-price-row competitor-sync-final-price">
                        <span>Итоговая</span>
                        <strong>{Number(row.proposedBasePrice).toLocaleString("ru-RU")} ₽</strong>
                      </div>
                    )}
                  </section>

                  <section className="competitor-sync-panel">
                    <div className="competitor-sync-panel-title">Опции и варианты</div>
                    <div className="muted">Текущие: {formatOptionsSummary(row.currentOptions)}</div>
                    <div className="competitor-sync-options-wrap">
                      {renderOptionsDetails(row.currentOptions, "Текущие опции")}
                    </div>
                    <div className="muted">Новые: {formatOptionsSummary(row.proposedOptions)}</div>
                    <div className="competitor-sync-options-wrap">
                      {renderOptionsDetails(row.proposedOptions, "Новые опции", true)}
                    </div>
                  </section>

                  <section className="competitor-sync-panel competitor-sync-panel-actions">
                    <div className="competitor-sync-panel-title">Действия</div>
                    {row.note ? <div className="muted">{row.note}</div> : <div className="muted">Без дополнительных заметок.</div>}
                    <div className="muted">Вариантов к импорту: {row.proposedVariantCount}</div>
                    {row.status === "pending" ? (
                      <form action={applyCompetitorPriceReviewRowAction}>
                        <input type="hidden" name="rowId" value={row.id} />
                        <input type="hidden" name="runId" value={selectedRun.id} />
                        <input type="hidden" name="category" value={selectedCategorySlug} />
                        <PendingSubmitButton idleLabel="Применить строку" pendingLabel="Применяем..." />
                      </form>
                    ) : null}
                  </section>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}