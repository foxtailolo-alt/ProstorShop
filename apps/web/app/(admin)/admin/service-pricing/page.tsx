import { listServicePriceRows, listServicePriceVersions } from "../../../../lib/data/pricing";
import { prisma } from "@prostor/db";
import { isMarketingMode } from "../../../../lib/auth/marketing";
import { AdminPagination, AdminSearch, PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import { importServicePricingAction, updateServiceRequestStatusAction } from "./actions";

const serviceRequestStatuses = [
  { value: "new", label: "Новая" },
  { value: "contacted", label: "Связались" },
  { value: "accepted", label: "Принята" },
  { value: "completed", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
] as const;

type AdminServicePricingPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function AdminServicePricingPage({ searchParams }: AdminServicePricingPageProps) {
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

  const [rows, versions, totalCount, requests, marketingMode] = await Promise.all([
    listServicePriceRows(),
    listServicePriceVersions(),
    prisma.serviceRequest.count({ where: searchWhere }),
    prisma.serviceRequest.findMany({
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
        <div className="section-label">Прайс сервиса</div>
        <h1>Импорт прайса ремонта из CSV или XLSX.</h1>
        <p>
          Активной становится только последняя загруженная версия. Витрина и калькулятор читают
          тот же активный прайс без ручного дублирования.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">Загрузить новый прайс</div>
        <form action={importServicePricingAction} className="grid" encType="multipart/form-data">
          <label className="field">
            <span>Файл CSV или XLSX</span>
            <input name="priceFile" type="file" accept=".csv,.xlsx,.xls" required />
          </label>
          <div className="muted">
            Ожидаемые колонки: `brand`, `model`, `repairType`, `price` или русские аналоги.
          </div>
          <div className="actions">
            <button className="button button-primary" type="submit">
              Импортировать прайс
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }} className="grid grid-2">
        <article className="card glass">
          <div className="section-label">Версии прайса</div>
          <div className="grid">
            {versions.length === 0 ? <p>Пока используется seed-версия.</p> : null}
            {versions.map((version) => (
              <div key={version.id} className="pill">
                v{version.version} • {version.sourceFile} • {version._count.rows} строк • {version.isActive ? "Активна" : "Архив"}
              </div>
            ))}
          </div>
        </article>
        <article className="card glass">
          <div className="section-label">Активный прайс</div>
          <div className="stat">{rows.length}</div>
          <p>Строк в текущем пользовательском калькуляторе сервиса.</p>
        </article>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Текущие строки</div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Бренд</div>
            <div>Модель</div>
            <div>Ремонт</div>
            <div>Цена</div>
            <div>Источник</div>
          </div>
          {rows.map((row) => (
            <div key={`${row.brand}-${row.model}-${row.repairType}`} className="admin-table-row">
              <div>{row.brand}</div>
              <div>{row.model}</div>
              <div>{row.repairType}</div>
              <div>{row.price.toLocaleString("ru-RU")} ₽</div>
              <div>Активная версия</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Последние заявки сервиса ({totalCount})</div>
        <AdminSearch basePath="/admin/service-pricing" query={searchQuery} placeholder="Поиск по имени, телефону, бренду или модели..." />
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
                <div className="muted">{request.repairType}</div>
                {request.note ? <div className="muted">{request.note}</div> : null}
              </div>
              <div>{Number(request.quote).toLocaleString("ru-RU")} ₽</div>
              <div>
                <form action={updateServiceRequestStatusAction} className="form-grid">
                  <input type="hidden" name="requestId" value={request.id} />
                  <label className="field field-wide">
                    <span>Статус</span>
                    <select name="status" defaultValue={request.status}>
                      {serviceRequestStatuses.map((status) => (
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
        <AdminPagination basePath="/admin/service-pricing" currentPage={currentPage} totalPages={totalPages} searchQuery={searchQuery} />
      </section>
    </main>
  );
}