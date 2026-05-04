import { tradeInConditions } from "@prostor/core";
import { getActiveTradeInSnapshot, listTradeInSnapshots } from "../../../../lib/data/pricing";
import { prisma } from "@prostor/db";
import { isMarketingMode } from "../../../../lib/auth/marketing";
import { AdminPagination, AdminSearch, PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import { summarizeTradeInAnswers } from "../../../../lib/trade-in-snapshot";
import { refreshTradeInSnapshotAction, updateTradeInRequestStatusAction } from "./actions";

const tradeInRequestStatuses = [
  { value: "new", label: "Новая" },
  { value: "contacted", label: "Связались" },
  { value: "diagnostics", label: "Диагностика" },
  { value: "completed", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
] as const;

type AdminTradeInPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function AdminTradeInPage({ searchParams }: AdminTradeInPageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const currentPage = Math.max(1, Number(params.page) || 1);

  const searchWhere = searchQuery
    ? {
        OR: [
          { customerName: { contains: searchQuery, mode: "insensitive" as const } },
          { phone: { contains: searchQuery, mode: "insensitive" as const } },
          { brand: { contains: searchQuery, mode: "insensitive" as const } },
          { model: { contains: searchQuery, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [activeSnapshot, snapshots, totalCount, requests, marketingMode] = await Promise.all([
    getActiveTradeInSnapshot(),
    listTradeInSnapshots(),
    prisma.tradeInRequest.count({ where: searchWhere }),
    prisma.tradeInRequest.findMany({
      where: searchWhere,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    isMarketingMode(),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const answerSummaryByRequestId: Record<string, ReturnType<typeof summarizeTradeInAnswers>> = activeSnapshot
    ? Object.fromEntries(
        requests.map((request) => {
          const parsedAnswers = request.categoryCode && request.answersJson && typeof request.answersJson === "object" && !Array.isArray(request.answersJson)
            ? Object.fromEntries(
                Object.entries(request.answersJson)
                  .filter(([, value]) => typeof value === "string")
                  .map(([key, value]) => [key, String(value)]),
              )
            : {};

          return [
            request.id,
            request.categoryCode ? summarizeTradeInAnswers(activeSnapshot, request.categoryCode, parsedAnswers) : [],
          ];
        }),
      ) as Record<string, ReturnType<typeof summarizeTradeInAnswers>>
    : {};

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Trade-in</div>
        <h1>Snapshot-оценка из DamProdam без ручного редактирования правил.</h1>
        <p>
          Локальный ProstorTradeInBot работает от активного snapshot. Здесь та же модель: обновляете snapshot,
          а витрина и заявки сразу читают актуальный wizard и live-оценку.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">Обновить snapshot</div>
        <form action={refreshTradeInSnapshotAction} className="form-grid">
          <div className="muted field-wide">
            Источник: DamProdam API. Поддерживаются категории iPhone, MacBook/iMac, Samsung, iPad и Apple Watch.
          </div>
          <div className="actions field-wide">
            <button className="button button-primary" type="submit">
              Обновить snapshot из DamProdam
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }} className="grid grid-2">
        <article className="card glass">
          <div className="section-label">Активный snapshot</div>
          <div className="stat">{activeSnapshot?.version ?? "—"}</div>
          <p>
            {activeSnapshot
              ? `${activeSnapshot.categories.length} категорий • ${activeSnapshot.categories.reduce<number>((total, category) => total + category.models.length, 0)} моделей • ${activeSnapshot.categories.reduce<number>((total, category) => total + category.questions.length, 0)} вопросов.`
              : "Активный snapshot еще не загружен."}
          </p>
        </article>
        <article className="card glass">
          <div className="section-label">История snapshot</div>
          <div className="grid">
            {snapshots.length === 0 ? <p>История snapshot пока пуста.</p> : null}
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="pill">
                v{snapshot.version} • {snapshot.sourceName} • {snapshot.status} • {snapshot.categories.length} категорий
              </div>
            ))}
          </div>
        </article>
      </section>

      {activeSnapshot ? (
        <section style={{ marginTop: 18 }} className="card glass">
          <div className="section-label">Категории и wizard</div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <div>Категория</div>
              <div>Модели</div>
              <div>Вопросы</div>
              <div>Источник</div>
            </div>
            {activeSnapshot.categories.map((category) => (
              <div key={category.id ?? category.categoryCode} className="admin-table-row">
                <div>
                  <strong>{category.title}</strong>
                  <div className="muted">{category.categoryCode}</div>
                </div>
                <div>{category.models.length}</div>
                <div>
                  {category.questions.length}
                  <div className="muted">{category.questions.map((question) => question.title).slice(0, 3).join(" • ")}</div>
                </div>
                <div>{activeSnapshot.sourceName}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Последние заявки Trade-in ({totalCount})</div>
        <AdminSearch basePath="/admin/trade-in" query={searchQuery} placeholder="Поиск по имени, телефону, бренду или модели..." />
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Клиент</div>
            <div>Устройство</div>
            <div>Оценка</div>
            <div>Статус</div>
            {marketingMode && <div>Источник</div>}
          </div>
          {requests.map((request) => (
            <div key={request.id} className="admin-table-row">
              <div>
                <strong>{request.customerName}</strong>
                <div className="muted">{request.phone}</div>
                <div className="muted">{request.createdAt.toLocaleString("ru-RU")}</div>
              </div>
              <div>
                <strong>{request.brand}</strong>
                <div className="muted">{request.model}</div>
                <div className="muted">{request.storage ?? "-"} • {tradeInConditions.find((item) => item.value === request.condition)?.label ?? request.condition}</div>
                {request.categoryCode ? <div className="muted">Категория: {request.categoryCode}</div> : null}
                {answerSummaryByRequestId[request.id]?.length ? (
                  <div className="trade-in-admin-answer-list">
                    {(answerSummaryByRequestId[request.id] ?? []).map((item) => (
                      <div key={`${request.id}-${item.code}`} className="trade-in-admin-answer-item">
                        <span>{item.title}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                {request.note ? <div className="muted">{request.note}</div> : null}
              </div>
              <div>{Number(request.quote).toLocaleString("ru-RU")} ₽</div>
              <div>
                <form action={updateTradeInRequestStatusAction} className="form-grid">
                  <input type="hidden" name="requestId" value={request.id} />
                  <label className="field field-wide">
                    <span>Статус</span>
                    <select name="status" defaultValue={request.status}>
                      {tradeInRequestStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="actions field-wide">
                    <button className="button button-secondary" type="submit">
                      Сохранить
                    </button>
                  </div>
                </form>
              </div>
              {marketingMode && (
                <div>
                  {request.attribution && typeof request.attribution === "object" && !Array.isArray(request.attribution) ? (
                    <>
                      {"source" in request.attribution && typeof request.attribution.source === "string" ? <div className="muted">Source: {request.attribution.source}</div> : null}
                      {"utmSource" in request.attribution && typeof request.attribution.utmSource === "string" ? <div className="muted">UTM: {request.attribution.utmSource}</div> : null}
                      {"landingPath" in request.attribution && typeof request.attribution.landingPath === "string" ? <div className="muted">Landing: {request.attribution.landingPath}</div> : null}
                    </>
                  ) : (
                    <span className="muted">Нет данных</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <AdminPagination basePath="/admin/trade-in" currentPage={currentPage} totalPages={totalPages} searchQuery={searchQuery} />
      </section>
    </main>
  );
}