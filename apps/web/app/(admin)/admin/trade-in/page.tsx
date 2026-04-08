import { tradeInConditions } from "@prostor/core";
import { listTradeInRules } from "../../../../lib/data/pricing";
import { prisma } from "@prostor/db";
import { isMarketingMode } from "../../../../lib/auth/marketing";
import { AdminPagination, AdminSearch, PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import { deleteTradeInRuleAction, updateTradeInRequestStatusAction, upsertTradeInRuleAction } from "./actions";
import { ConfirmButton } from "../../../../components/admin/confirm-button";

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

  const [rules, totalCount, requests, marketingMode] = await Promise.all([
    listTradeInRules(),
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

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Trade-in</div>
        <h1>Редактирование матрицы оценки без изменения кода.</h1>
        <p>
          Это критично для гибкости магазина: менеджер меняет цену в админке, а калькулятор на
          витрине сразу читает активную матрицу из того же источника.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">Добавить или обновить правило</div>
        <form action={upsertTradeInRuleAction} className="form-grid">
          <label className="field">
            <span>Бренд</span>
            <input name="brand" type="text" placeholder="Apple" required />
          </label>
          <label className="field">
            <span>Модель</span>
            <input name="model" type="text" placeholder="iPhone 15 Pro" required />
          </label>
          <label className="field">
            <span>Память</span>
            <input name="storage" type="text" placeholder="256 ГБ" />
          </label>
          <label className="field">
            <span>Состояние</span>
            <select name="condition" defaultValue={tradeInConditions[0]?.value}>
              {tradeInConditions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Цена</span>
            <input name="price" type="number" min="1" step="1" placeholder="54000" required />
          </label>
          <div className="actions field-wide">
            <button className="button button-primary" type="submit">
              Сохранить правило
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Активные правила</div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Устройство</div>
            <div>Память</div>
            <div>Состояние</div>
            <div>Цена</div>
            <div>Действия</div>
          </div>
          {rules.map((rule) => (
            <div key={`${rule.brand}-${rule.model}-${rule.storage}-${rule.condition}`} className="admin-table-row">
              <div>
                <strong>{rule.brand}</strong>
                <div className="muted">{rule.model}</div>
              </div>
              <div>{rule.storage ?? "-"}</div>
              <div>{tradeInConditions.find((item) => item.value === rule.condition)?.label ?? rule.condition}</div>
              <div>{rule.price.toLocaleString("ru-RU")} ₽</div>
              <div className="actions">
                <form action={deleteTradeInRuleAction}>
                  <input type="hidden" name="brand" value={rule.brand} />
                  <input type="hidden" name="model" value={rule.model} />
                  <input type="hidden" name="storage" value={rule.storage ?? ""} />
                  <input type="hidden" name="condition" value={rule.condition} />
                  <ConfirmButton message={`Удалить правило ${rule.brand} ${rule.model}?`}>
                    Удалить
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

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