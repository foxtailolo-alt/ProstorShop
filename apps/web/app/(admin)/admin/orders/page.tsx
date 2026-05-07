import Link from "next/link";
import { prisma } from "@prostor/db";
import { AdminPagination, PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import { isMarketingMode } from "../../../../lib/auth/marketing";
import { formatCustomerName, inferCustomerSource, parseCustomerAttribution } from "../../../../lib/admin-customers";
import { requirePermission } from "../../../../lib/auth/session";
import { formatOrderNumber } from "../../../../lib/order-number";
import { updateOrderStatusAction } from "./actions";

const orderStatuses = [
  { value: "pending", label: "Новая", tone: "rgba(255, 211, 138, 0.22)" },
  { value: "contacted", label: "Связались", tone: "rgba(185, 214, 255, 0.22)" },
  { value: "confirmed", label: "Подтверждена", tone: "rgba(172, 236, 198, 0.22)" },
  { value: "completed", label: "Завершена", tone: "rgba(162, 235, 201, 0.28)" },
  { value: "cancelled", label: "Отменена", tone: "rgba(255, 170, 170, 0.22)" },
] as const;

type OrderStatusValue = (typeof orderStatuses)[number]["value"];
const orderStatusMap = new Map(orderStatuses.map((status) => [status.value, status]));

function formatCurrency(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function getOrderStatusMeta(status: string) {
  return orderStatusMap.get(status as OrderStatusValue);
}

function buildOrdersHref(params: {
  q?: string;
  user?: string;
  status?: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.user) searchParams.set("user", params.user);
  if (params.status) searchParams.set("status", params.status);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));

  const queryString = searchParams.toString();
  return (queryString ? `/admin/orders?${queryString}` : "/admin/orders") as "/";
}

type AdminOrdersPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    user?: string;
    status?: string;
  }>;
};

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  await requirePermission("orders", "read");

  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const currentPage = Math.max(1, Number(params.page) || 1);
  const userFilter = params.user?.trim() ?? "";
  const statusFilter = params.status?.trim() ?? "";
  const marketingMode = await isMarketingMode();

  const searchWhere = {
    AND: [
      userFilter ? { userId: userFilter } : {},
      statusFilter ? { status: statusFilter } : {},
      searchQuery
        ? {
            OR: [
              { customerName: { contains: searchQuery, mode: "insensitive" as const } },
              { phone: { contains: searchQuery, mode: "insensitive" as const } },
              { id: { contains: searchQuery, mode: "insensitive" as const } },
              { orderNumber: { contains: searchQuery, mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

  const [totalCount, orders, statusCounts, totals] = await Promise.all([
    prisma.order.count({ where: searchWhere }),
    prisma.order.findMany({
      where: searchWhere,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        appliedPromoCode: true,
        user: true,
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: searchWhere,
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: searchWhere,
      _sum: { total: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const revenue = Number(totals._sum.total ?? 0);
  const pendingCount = statusCounts.find((entry) => entry.status === "pending")?._count._all ?? 0;
  const completedCount = statusCounts.find((entry) => entry.status === "completed")?._count._all ?? 0;

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Заказы</div>
        <h1>CRM-вид заказов: клиент, состав корзины, источник и следующий шаг на одном экране.</h1>
        <p>
          Здесь удобно разбирать поток заявок как в операционном дашборде: быстро видеть приоритет,
          обновлять статус и переходить в клиента без перегруженной таблицы.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 18 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Всего заказов</div>
            <strong style={{ fontSize: "1.5rem" }}>{totalCount}</strong>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Ожидают обработки</div>
            <strong style={{ fontSize: "1.5rem" }}>{pendingCount}</strong>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Завершены</div>
            <strong style={{ fontSize: "1.5rem" }}>{completedCount}</strong>
          </div>
        </div>
        <div style={{ marginTop: 12 }} className="muted">Сумма текущей выборки: {formatCurrency(revenue)}</div>
        {userFilter || statusFilter ? (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {userFilter ? <span className="pill">Фильтр: клиент</span> : null}
            {statusFilter ? <span className="pill">Статус: {getOrderStatusMeta(statusFilter)?.label ?? statusFilter}</span> : null}
            <Link href="/admin/orders" className="button button-secondary button-sm">Сбросить фильтры</Link>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Очередь заказов</div>

        <form method="get" className="admin-filter-row" style={{ marginBottom: 14 }}>
          <input name="q" placeholder="Имя, телефон, номер заказа..." defaultValue={searchQuery} />
          <select name="status" defaultValue={statusFilter}>
            <option value="">Все статусы</option>
            {orderStatuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          {userFilter ? <input type="hidden" name="user" value={userFilter} /> : null}
          <button className="button button-secondary button-sm" type="submit">Применить</button>
        </form>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Link href={buildOrdersHref({ q: searchQuery, user: userFilter })} className={`pill ${!statusFilter ? "pill-success" : "pill-muted"}`}>
            Все
          </Link>
          {orderStatuses.map((status) => {
            const count = statusCounts.find((entry) => entry.status === status.value)?._count._all ?? 0;

            return (
              <Link
                key={status.value}
                href={buildOrdersHref({ q: searchQuery, user: userFilter, status: status.value })}
                className={`pill ${statusFilter === status.value ? "pill-success" : "pill-muted"}`}
              >
                {status.label} {count > 0 ? `(${count})` : ""}
              </Link>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {orders.map((order) => {
            const attribution = parseCustomerAttribution(order.attribution);
            const customerSource = inferCustomerSource({ telegramId: order.user?.telegramId, orders: [order] });
            const customerName = order.user ? formatCustomerName(order.user) : order.customerName;
            const statusMeta = getOrderStatusMeta(order.status);

            return (
              <article key={order.id} className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div className="section-label">{formatOrderNumber({ id: order.id, orderNumber: order.orderNumber, createdAt: order.createdAt })}</div>
                    {order.userId ? (
                      <Link href={`/admin/clients?client=${encodeURIComponent(order.userId)}` as "/"}>
                        <strong style={{ fontSize: "1.05rem" }}>{customerName}</strong>
                      </Link>
                    ) : (
                      <strong style={{ fontSize: "1.05rem" }}>{order.customerName}</strong>
                    )}
                    <div className="muted">{order.phone}</div>
                    <div className="muted">Создан: {order.createdAt.toLocaleString("ru-RU")}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                    <span className="pill" style={{ background: statusMeta?.tone }}>
                      {statusMeta?.label ?? order.status}
                    </span>
                    <span className="pill">{customerSource.label}</span>
                    <strong style={{ fontSize: "1.2rem" }}>{formatCurrency(Number(order.total))}</strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 14,
                    gridTemplateColumns: marketingMode
                      ? "minmax(0, 1.25fr) minmax(320px, 0.8fr) minmax(240px, 0.75fr)"
                      : "minmax(0, 1.45fr) minmax(260px, 0.75fr)",
                  }}
                >
                  <div className="card" style={{ padding: 12 }}>
                    <div className="section-label" style={{ marginBottom: 8 }}>Состав заказа</div>
                    <div className="admin-order-item-list">
                      {order.items.length > 0 ? (
                        order.items.map((item) => (
                          <div key={item.id} className="admin-order-item-card">
                            <div className="admin-order-item-main">
                              <div className="admin-order-item-media">
                                {item.product?.imageUrls?.[0] || item.product?.imageUrl ? (
                                  <img
                                    src={item.product?.imageUrls?.[0] ?? item.product?.imageUrl ?? ""}
                                    alt={item.product?.name ?? "Товар"}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="product-media-fallback" style={{ minHeight: 0 }} />
                                )}
                              </div>
                              <div className="admin-order-item-copy">
                                <strong>{item.product?.name ?? "Удалённый товар"}</strong>
                                <div className="muted">
                                  {item.variantLabel ? `${item.variantLabel} • ` : ""}Количество: {item.quantity}
                                </div>
                                <div className="muted">За единицу: {formatCurrency(Number(item.price))}</div>
                              </div>
                            </div>
                            <strong>{formatCurrency(Number(item.price) * item.quantity)}</strong>
                          </div>
                        ))
                      ) : (
                        <span className="muted">Без позиций</span>
                      )}
                      {order.appliedPromoCode ? (
                        <div className="muted">
                          Промокод: {order.appliedPromoCode.code}
                          {order.promoRewardDescription ? ` • ${order.promoRewardDescription}` : ""}
                        </div>
                      ) : null}
                      {order.cashbackPointsAwarded > 0 ? (
                        <div className="muted">Клиенту начислено баллов: {order.cashbackPointsAwarded}</div>
                      ) : null}
                      {order.note ? <div className="muted">Комментарий: {order.note}</div> : null}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 12 }}>
                    <div className="section-label" style={{ marginBottom: 8 }}>Следующий шаг</div>
                    <form action={updateOrderStatusAction} className="form-grid">
                      <input type="hidden" name="orderId" value={order.id} />
                      <label className="field field-wide">
                        <span>Статус</span>
                        <select name="status" defaultValue={order.status}>
                          {orderStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="actions field-wide">
                        <button className="button button-secondary" type="submit">
                          Сохранить статус
                        </button>
                      </div>
                    </form>
                    {order.userId ? (
                      <div style={{ marginTop: 10 }}>
                        <Link href={`/admin/clients?client=${encodeURIComponent(order.userId)}` as "/"} className="button button-secondary button-sm">
                          Перейти в клиента
                        </Link>
                      </div>
                    ) : null}
                  </div>

                  {marketingMode ? (
                    <div className="card" style={{ padding: 12 }}>
                      <div className="section-label" style={{ marginBottom: 8 }}>Маркетинг</div>
                      {attribution?.source ? <div className="muted">Source: {attribution.source}</div> : null}
                      {attribution?.utmSource ? <div className="muted">UTM: {attribution.utmSource}</div> : null}
                      {attribution?.utmCampaign ? <div className="muted">Campaign: {attribution.utmCampaign}</div> : null}
                      {attribution?.yclid ? <div className="muted">YCLID: {attribution.yclid}</div> : null}
                      {attribution?.landingPath ? <div className="muted">Landing: {attribution.landingPath}</div> : null}
                      {!attribution ? <span className="muted">Нет данных</span> : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}

          {orders.length === 0 ? (
            <div className="card" style={{ padding: 18 }}>
              <div className="section-label">Нет результатов</div>
              <p className="muted" style={{ marginBottom: 0 }}>По текущим фильтрам заказы не найдены.</p>
            </div>
          ) : null}
        </div>

        <AdminPagination
          basePath="/admin/orders"
          currentPage={currentPage}
          totalPages={totalPages}
          searchQuery={searchQuery}
          extraParams={{ user: userFilter, status: statusFilter }}
        />
      </section>
    </main>
  );
}