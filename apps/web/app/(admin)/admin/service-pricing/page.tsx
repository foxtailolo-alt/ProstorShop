import { listServiceCatalogEntries, listServiceCatalogImports } from "../../../../lib/data/pricing";
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
          { repairType: { contains: searchQuery, mode: "insensitive" as const } },
          { variantName: { contains: searchQuery, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, imports, totalCount, requests, marketingMode] = await Promise.all([
    listServiceCatalogEntries(),
    listServiceCatalogImports(),
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
  const servicesCount = new Set(rows.map((row) => row.serviceSlug)).size;
  const modelsCount = new Set(rows.map((row) => `${row.brand}::${row.modelSlug}`)).size;

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Прайс сервиса</div>
        <h1>Импорт прайса ремонта из Excel.</h1>
        <p>
          Загрузите тот же Excel-прайс, который использовался в RepairProstorBot. Витрина сервиса
          и заявки читают активный каталог без ручного дублирования.
        </p>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">Загрузить новый прайс</div>
        <form action={importServicePricingAction} className="grid">
          <label className="field">
            <span>Файл XLSX или XLS</span>
            <input name="priceFile" type="file" accept=".xlsx,.xls" required />
          </label>
          <div className="muted">
            Ожидаются листы <strong>Прайс АКБ</strong> и <strong>Прайс Крышки (копия)</strong> в формате текущего сервисного Excel.
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
          <div className="section-label">Последние импорты</div>
          <div className="grid">
            {imports.length === 0 ? <p>История импортов пока пуста.</p> : null}
            {imports.map((item) => (
              <div key={item.id} className="pill">
                {item.sourceFile} • {item.createdAt.toLocaleString("ru-RU")}
              </div>
            ))}
          </div>
        </article>
        <article className="card glass">
          <div className="section-label">Активный каталог</div>
          <div className="stat">{rows.length}</div>
          <p>{servicesCount} услуг • {modelsCount} моделей • {rows.length} вариантов ремонта.</p>
        </article>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Текущие варианты ремонта</div>
        <details className="admin-collapsible-section">
          <summary className="admin-collapsible-summary">
            <span>Показать варианты ремонта</span>
            <span className="admin-collapsible-meta">{rows.length} записей</span>
          </summary>
          <div className="admin-table admin-collapsible-content">
            <div className="admin-table-row admin-table-head">
              <div>Бренд</div>
              <div>Модель</div>
              <div>Услуга</div>
              <div>Вариант</div>
              <div>Цена</div>
              <div>Источник</div>
            </div>
            {rows.map((row) => (
              <div key={row.variantId} className="admin-table-row">
                <div>{row.brand}</div>
                <div>{row.modelName}</div>
                <div>{row.serviceName}</div>
                <div>
                  <strong>{row.variantName}</strong>
                  <div className="muted">{row.variantDescription}</div>
                </div>
                <div>
                  <strong>{row.totalPrice.toLocaleString("ru-RU")} ₽</strong>
                  <div className="muted">Деталь: {row.partPrice.toLocaleString("ru-RU")} ₽</div>
                  <div className="muted">Работа: {row.laborPrice.toLocaleString("ru-RU")} ₽</div>
                </div>
                <div>{row.sourceFile}</div>
              </div>
            ))}
          </div>
        </details>
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
                {request.variantName ? <div className="muted">Вариант: {request.variantName}</div> : null}
                {request.variantDescription ? <div className="muted">{request.variantDescription}</div> : null}
                {request.note ? <div className="muted">{request.note}</div> : null}
              </div>
              <div>
                <strong>{Number(request.quote).toLocaleString("ru-RU")} ₽</strong>
                {request.partPrice ? <div className="muted">Деталь: {Number(request.partPrice).toLocaleString("ru-RU")} ₽</div> : null}
                {request.laborPrice ? <div className="muted">Работа: {Number(request.laborPrice).toLocaleString("ru-RU")} ₽</div> : null}
              </div>
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