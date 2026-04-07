import Link from "next/link";
import { prisma } from "@prostor/db";
import {
  getCatalogSummaryData,
  getFeatureFlagEntries,
  listCatalogCategories,
  listCatalogProducts,
} from "../../../lib/data/catalog";
import { getAuditMetadataEntries } from "../../../lib/audit";
import { getSession } from "../../../lib/auth/session";

export default async function AdminPage() {
  const [session, catalogSummary, catalogCategories, catalogProducts, featureFlags, orders, tradeInRequests, serviceRequests, activityLogs] = await Promise.all([
    getSession(),
    getCatalogSummaryData(),
    listCatalogCategories(),
    listCatalogProducts(),
    getFeatureFlagEntries(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.tradeInRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.serviceRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true },
      take: 8,
    }),
  ]);

  const adminSession = session!;
  const newOrders = orders.filter((order) => order.status === "pending").length;
  const newTradeInRequests = tradeInRequests.filter((request) => request.status === "new").length;
  const newServiceRequests = serviceRequests.filter((request) => request.status === "new").length;
  const enabledFeatureFlags = featureFlags.filter((flag) => flag.enabled).length;
  const outOfStockProducts = catalogProducts.filter((product) => !product.inStock).length;

  return (
    <main className="page shell">
      <section className="hero glass">
        <div className="section-label">Админка</div>
        <h1>Операционная панель магазина.</h1>
        <p>
          Здесь менеджер должен быстро видеть очередь обращений, каталог, недостающие данные и
          последние действия команды. Без презентационных блоков и лишних обещаний.
        </p>
        <div className="actions">
          <div className="pill">Пользователь: {adminSession.user.firstName ?? adminSession.user.username ?? adminSession.user.telegramId}</div>
          <div className="pill">Роли: {adminSession.user.roles.join(", ")}</div>
          <Link className="button button-primary" href="/admin/orders">
            Открыть заказы
          </Link>
          <Link className="button button-secondary" href="/admin/products">
            Открыть каталог
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="button button-secondary" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="grid grid-4">
        <article className="card glass admin-kpi-card">
          <div className="section-label">Новые заказы</div>
          <div className="stat">{newOrders}</div>
          <p>Требуют контакта менеджера.</p>
          <Link className="button button-secondary" href="/admin/orders">
            Перейти к заказам
          </Link>
        </article>
        <article className="card glass admin-kpi-card">
          <div className="section-label">Trade-in</div>
          <div className="stat">{newTradeInRequests}</div>
          <p>Новых заявок на оценку.</p>
          <Link className="button button-secondary" href="/admin/trade-in">
            Открыть обращения
          </Link>
        </article>
        <article className="card glass admin-kpi-card">
          <div className="section-label">Сервис</div>
          <div className="stat">{newServiceRequests}</div>
          <p>Новых заявок на ремонт.</p>
          <Link className="button button-secondary" href="/admin/service-pricing">
            Открыть сервис
          </Link>
        </article>
        <article className="card glass admin-kpi-card">
          <div className="section-label">Каталог</div>
          <div className="stat">{catalogSummary.products}</div>
          <p>Товаров в рабочем каталоге.</p>
          <Link className="button button-secondary" href="/admin/products">
            Редактировать товары
          </Link>
        </article>
      </section>

      <section style={{ marginTop: 18 }} className="grid grid-3">
        <article className="card glass admin-panel-card">
          <div className="section-label">Очередь заказов</div>
          {orders.length === 0 ? <p>Заказов пока нет.</p> : null}
          <div className="grid">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="admin-list-row">
                <div>
                  <strong>{order.customerName}</strong>
                  <div className="muted">{order.phone}</div>
                </div>
                <div className="admin-list-meta">
                  <div>{Number(order.total).toLocaleString("ru-RU")} ₽</div>
                  <div className="muted">{order.status}</div>
                </div>
              </div>
            ))}
          </div>
          <Link className="button button-secondary" href="/admin/orders">
            Все заказы
          </Link>
        </article>

        <article className="card glass admin-panel-card">
          <div className="section-label">Каталог</div>
          <div className="grid">
            <div className="admin-list-row">
              <span>Категории</span>
              <strong>{catalogSummary.categories}</strong>
            </div>
            <div className="admin-list-row">
              <span>В наличии</span>
              <strong>{catalogSummary.productsInStock}</strong>
            </div>
            <div className="admin-list-row">
              <span>Под заказ</span>
              <strong>{outOfStockProducts}</strong>
            </div>
            <div className="admin-list-row">
              <span>Включено feature flags</span>
              <strong>{enabledFeatureFlags}</strong>
            </div>
          </div>
          <div className="actions">
            <Link className="button button-secondary" href="/admin/products">
              Товары
            </Link>
            <Link className="button button-secondary" href="/admin/categories">
              Категории
            </Link>
          </div>
        </article>

        <article className="card glass admin-panel-card">
          <div className="section-label">Обращения</div>
          <div className="grid">
            <div className="admin-list-row">
              <span>Trade-in всего</span>
              <strong>{tradeInRequests.length}</strong>
            </div>
            <div className="admin-list-row">
              <span>Service всего</span>
              <strong>{serviceRequests.length}</strong>
            </div>
            <div className="admin-list-row">
              <span>Нужен ответ</span>
              <strong>{newTradeInRequests + newServiceRequests}</strong>
            </div>
          </div>
          <div className="actions">
            <Link className="button button-secondary" href="/admin/trade-in">
              Trade-in
            </Link>
            <Link className="button button-secondary" href="/admin/service-pricing">
              Сервис
            </Link>
          </div>
        </article>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Структура каталога</div>
        <div className="grid grid-3">
          {catalogCategories.map((category) => (
            <div key={category.slug} className="pill">
              {category.name}: {catalogProducts.filter((item) => item.categorySlug === category.slug).length}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Feature flags</div>
        <div className="grid grid-2">
          {featureFlags.map((flag) => (
            <div key={flag.key} className="pill">
              {flag.key}: {flag.enabled ? "on" : "off"}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Последние действия команды</div>
        <div className="grid">
          {activityLogs.length === 0 ? <p>Журнал пока пуст.</p> : null}
          <div className="actions">
            <Link className="button button-secondary" href="/admin/activity?entity=order">
              Только заказы
            </Link>
            <Link className="button button-secondary" href="/admin/activity?entity=trade-in-request">
              Только Trade-in
            </Link>
            <Link className="button button-secondary" href="/admin/activity?entity=service-request">
              Только сервис
            </Link>
            <Link className="button button-secondary" href="/admin/activity?entity=product">
              Только каталог
            </Link>
          </div>
          {activityLogs.map((log) => {
            const metadataEntries = getAuditMetadataEntries(log.metadata).slice(0, 2);

            return (
              <article key={log.id} className="card glass">
                <div className="section-label">{log.action}</div>
                <strong>{log.summary}</strong>
                <div className="muted">
                  {log.createdAt.toLocaleString("ru-RU")} • {log.user?.firstName ?? log.user?.telegramUsername ?? log.user?.telegramId ?? "System"}
                </div>
                {metadataEntries.length > 0 ? (
                  <div className="actions">
                    {metadataEntries.map((entry) => (
                      <div key={`${log.id}-${entry.key}`} className="pill pill-compact">
                        {entry.key}: {entry.value}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="actions">
                  <Link className="button button-secondary" href={`/admin/activity?entity=${encodeURIComponent(log.entityType)}`}>
                    Похожие события
                  </Link>
                </div>
              </article>
            );
          })}
          <Link className="button button-secondary" href="/admin/activity">
            Открыть полный журнал
          </Link>
        </div>
      </section>
    </main>
  );
}