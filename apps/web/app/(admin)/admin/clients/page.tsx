import Link from "next/link";
import { prisma, type Prisma } from "@prostor/db";
import { AdminPagination, AdminSearch, PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import { requirePermission } from "../../../../lib/auth/session";
import {
  formatCustomerName,
  getCustomerTelegramUrl,
  inferCustomerSource,
  parseCustomerAttribution,
} from "../../../../lib/admin-customers";
import { adjustCustomerPointsAction } from "./actions";

const clientSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  telegramId: true,
  telegramUsername: true,
  loyaltyPoints: true,
  createdAt: true,
  orders: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      createdAt: true,
      attribution: true,
    },
  },
  promoCodes: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      type: true,
      isActive: true,
      usageCount: true,
      rewardDescription: true,
      ownerCashbackPercent: true,
      createdAt: true,
    },
  },
  pointTransactions: {
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      amount: true,
      kind: true,
      description: true,
      createdAt: true,
      orderId: true,
    },
  },
  _count: {
    select: {
      orders: true,
      pointTransactions: true,
      tradeInRequests: true,
      serviceRequests: true,
    },
  },
} satisfies Prisma.UserSelect;

type ClientRecord = Prisma.UserGetPayload<{ select: typeof clientSummarySelect }>;
type ClientPanel = "profile" | "orders" | "points";

function formatCurrency(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatSignedPoints(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Новая",
    contacted: "Связались",
    confirmed: "Подтверждена",
    completed: "Завершена",
    cancelled: "Отменена",
  };

  return labels[status] ?? status;
}

function getReferralPromo(client: ClientRecord) {
  return client.promoCodes.find((promo) => promo.type === "referral") ?? null;
}

function getTotalSpent(client: ClientRecord) {
  return client.orders.reduce((sum, order) => sum + Number(order.total), 0);
}

function buildClientsHref(input: {
  searchQuery: string;
  currentPage: number;
  clientId?: string;
  panel?: ClientPanel;
}) {
  const params = new URLSearchParams();

  if (input.searchQuery) params.set("q", input.searchQuery);
  if (input.currentPage > 1) params.set("page", String(input.currentPage));
  if (input.clientId) params.set("client", input.clientId);
  if (input.panel) params.set("panel", input.panel);

  const queryString = params.toString();
  return (queryString ? `/admin/clients?${queryString}` : "/admin/clients") as "/";
}

function buildOrdersHref(userId: string) {
  return `/admin/orders?user=${encodeURIComponent(userId)}` as "/";
}

function renderPanelTitle(panel: ClientPanel) {
  if (panel === "orders") return "Заказы клиента";
  if (panel === "points") return "Баллы клиента";
  return "Карточка клиента";
}

type AdminClientsPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    client?: string;
    panel?: string;
  }>;
};

export default async function AdminClientsPage({ searchParams }: AdminClientsPageProps) {
  await requirePermission("clients", "read");

  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const currentPage = Math.max(1, Number(params.page) || 1);
  const selectedClientId = params.client?.trim() ?? "";
  const activePanel = params.panel === "orders" || params.panel === "points" || params.panel === "profile"
    ? params.panel
    : "";

  const searchWhere = searchQuery
    ? {
        OR: [
          { firstName: { contains: searchQuery, mode: "insensitive" as const } },
          { lastName: { contains: searchQuery, mode: "insensitive" as const } },
          { telegramUsername: { contains: searchQuery, mode: "insensitive" as const } },
          { phone: { contains: searchQuery, mode: "insensitive" as const } },
          { id: { contains: searchQuery, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [totalCount, clients] = await Promise.all([
    prisma.user.count({ where: searchWhere }),
    prisma.user.findMany({
      where: searchWhere,
      orderBy: [{ orders: { _count: "desc" } }, { createdAt: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: clientSummarySelect,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  let selectedClient = selectedClientId ? clients.find((client) => client.id === selectedClientId) ?? null : null;

  if (!selectedClient && selectedClientId) {
    selectedClient = await prisma.user.findUnique({
      where: { id: selectedClientId },
      select: clientSummarySelect,
    });
  }

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Клиенты</div>
        <h1>Все клиенты на одной странице, детали открываются поверх по нужному действию.</h1>
        <p>
          Карточка, история заказов и операции с баллами больше не сжимают список: они открываются поверх,
          когда оператор нажимает на нужную часть строки клиента.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 18 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Всего клиентов</div>
            <strong style={{ fontSize: "1.4rem" }}>{totalCount}</strong>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>С заказами</div>
            <strong style={{ fontSize: "1.4rem" }}>{clients.filter((client) => client._count.orders > 0).length}</strong>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>С Telegram</div>
            <strong style={{ fontSize: "1.4rem" }}>{clients.filter((client) => Boolean(client.telegramUsername)).length}</strong>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Лояльность</div>
            <strong style={{ fontSize: "1.4rem" }}>{clients.reduce((sum, client) => sum + client.loyaltyPoints, 0)}</strong>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Все клиенты</div>
            <h2 style={{ marginBottom: 0 }}>{totalCount} в базе</h2>
          </div>
          {selectedClient && activePanel ? <span className="pill">Открыто: {renderPanelTitle(activePanel as ClientPanel)}</span> : null}
        </div>

        <AdminSearch basePath="/admin/clients" query={searchQuery} placeholder="Имя, телефон, Telegram, ID..." />

        <div className="admin-table admin-clients-table" style={{ gap: 0 }}>
          <div className="admin-table-row admin-table-head admin-clients-table-head">
            <div>Клиент</div>
            <div>Заказы</div>
            <div>Потратил</div>
            <div>Баллы</div>
            <div>Реф.</div>
            <div>Источник</div>
          </div>

          {clients.map((client) => {
            const clientName = formatCustomerName(client);
            const source = inferCustomerSource(client);
            const referralPromo = getReferralPromo(client);
            const totalSpent = getTotalSpent(client);
            const profileHref = buildClientsHref({ searchQuery, currentPage, clientId: client.id, panel: "profile" });
            const ordersHref = buildClientsHref({ searchQuery, currentPage, clientId: client.id, panel: "orders" });
            const pointsHref = buildClientsHref({ searchQuery, currentPage, clientId: client.id, panel: "points" });

            return (
              <div
                key={client.id}
                className="admin-table-row admin-clients-row"
                style={{
                  background: selectedClient?.id === client.id ? "linear-gradient(135deg, rgba(185,214,255,0.12), rgba(255,255,255,0.04))" : undefined,
                }}
              >
                <div className="admin-clients-main-cell">
                  <Link href={profileHref} className="admin-clients-name-link">
                    <strong>{clientName}</strong>
                  </Link>
                  <div className="muted">{client.phone || "Телефон не указан"}</div>
                  <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {client.telegramUsername ? <span>@{client.telegramUsername}</span> : null}
                    {selectedClient?.id === client.id && activePanel ? <span>Открыто</span> : null}
                  </div>
                </div>
                <div>
                  <Link href={ordersHref} className="admin-clients-cell-link">
                    <strong>{client._count.orders}</strong>
                  </Link>
                </div>
                <div>
                  <Link href={ordersHref} className="admin-clients-cell-link">
                    <strong>{formatCurrency(totalSpent)}</strong>
                  </Link>
                </div>
                <div>
                  <Link href={pointsHref} className="admin-clients-cell-link">
                    <strong>{client.loyaltyPoints}</strong>
                  </Link>
                </div>
                <div>
                  <Link href={profileHref} className="admin-clients-cell-link">
                    <strong>{referralPromo?.usageCount ?? 0}</strong>
                  </Link>
                </div>
                <div>
                  <Link href={profileHref} className="admin-clients-cell-link">
                    <span className="pill pill-muted pill-compact">{source.label}</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <AdminPagination basePath="/admin/clients" currentPage={currentPage} totalPages={totalPages} searchQuery={searchQuery} />
      </section>

      {selectedClient && activePanel ? (
        (() => {
          const clientName = formatCustomerName(selectedClient);
          const source = inferCustomerSource(selectedClient);
          const referralPromo = getReferralPromo(selectedClient);
          const telegramUrl = getCustomerTelegramUrl(selectedClient.telegramUsername);
          const totalSpent = getTotalSpent(selectedClient);
          const latestAttribution = selectedClient.orders.map((order) => parseCustomerAttribution(order.attribution)).find(Boolean);
          const closeHref = buildClientsHref({ searchQuery, currentPage });

          return (
            <div className="admin-clients-overlay">
              <div className="admin-clients-overlay-backdrop">
                <Link href={closeHref} className="admin-clients-overlay-dismiss" aria-label="Закрыть панель" />
                <section className="card glass admin-clients-overlay-panel">
                  <div className="admin-clients-overlay-header">
                    <div>
                      <div className="section-label">{renderPanelTitle(activePanel as ClientPanel)}</div>
                      <h2 style={{ marginBottom: 6 }}>{clientName}</h2>
                      <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span>ID: {selectedClient.id}</span>
                        <span>Создан: {selectedClient.createdAt.toLocaleString("ru-RU")}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                      <Link href={buildClientsHref({ searchQuery, currentPage, clientId: selectedClient.id, panel: "profile" })} className={`pill ${activePanel === "profile" ? "pill-success" : "pill-muted"}`}>
                        Карточка
                      </Link>
                      <Link href={buildClientsHref({ searchQuery, currentPage, clientId: selectedClient.id, panel: "orders" })} className={`pill ${activePanel === "orders" ? "pill-success" : "pill-muted"}`}>
                        Заказы
                      </Link>
                      <Link href={buildClientsHref({ searchQuery, currentPage, clientId: selectedClient.id, panel: "points" })} className={`pill ${activePanel === "points" ? "pill-success" : "pill-muted"}`}>
                        Баллы
                      </Link>
                      <Link href={closeHref} className="button button-secondary button-sm">Закрыть</Link>
                    </div>
                  </div>

                  {activePanel === "profile" ? (
                    <div className="admin-clients-overlay-body">
                      <div className="admin-clients-stats-grid">
                        <div className="card" style={{ padding: 14 }}>
                          <div className="section-label" style={{ marginBottom: 6 }}>Потратил</div>
                          <strong>{formatCurrency(totalSpent)}</strong>
                        </div>
                        <div className="card" style={{ padding: 14 }}>
                          <div className="section-label" style={{ marginBottom: 6 }}>Баллы</div>
                          <strong>{selectedClient.loyaltyPoints}</strong>
                        </div>
                        <div className="card" style={{ padding: 14 }}>
                          <div className="section-label" style={{ marginBottom: 6 }}>Заказы</div>
                          <strong>{selectedClient._count.orders}</strong>
                        </div>
                        <div className="card" style={{ padding: 14 }}>
                          <div className="section-label" style={{ marginBottom: 6 }}>Промо-использований</div>
                          <strong>{referralPromo?.usageCount ?? 0}</strong>
                        </div>
                      </div>

                      <div className="admin-clients-detail-grid">
                        <div className="card" style={{ padding: 16 }}>
                          <div className="section-label" style={{ marginBottom: 8 }}>Контакты</div>
                          <div className="muted">Телефон: {selectedClient.phone || "не указан"}</div>
                          <div className="muted">Telegram: {selectedClient.telegramUsername ? `@${selectedClient.telegramUsername}` : "не привязан"}</div>
                          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span className="pill pill-muted">{source.label}</span>
                            <Link href={buildOrdersHref(selectedClient.id)} className="button button-secondary button-sm">Открыть заказы</Link>
                            {telegramUrl ? (
                              <a href={telegramUrl} target="_blank" rel="noreferrer" className="button button-primary button-sm">Написать в Telegram</a>
                            ) : null}
                          </div>
                        </div>
                        <div className="card" style={{ padding: 16 }}>
                          <div className="section-label" style={{ marginBottom: 8 }}>Источник</div>
                          <div className="muted">Канал: {source.label}</div>
                          {latestAttribution?.source ? <div className="muted">Source: {latestAttribution.source}</div> : null}
                          {latestAttribution?.utmSource ? <div className="muted">UTM: {latestAttribution.utmSource}</div> : null}
                          {latestAttribution?.landingPath ? <div className="muted">Landing: {latestAttribution.landingPath}</div> : null}
                        </div>
                      </div>

                      <div className="card" style={{ padding: 16 }}>
                        <div className="section-label" style={{ marginBottom: 8 }}>Реферальный блок</div>
                        {referralPromo ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <strong>{referralPromo.code}</strong>
                            <div className="muted">Использований: {referralPromo.usageCount}</div>
                            <div className="muted">Награда: {referralPromo.rewardDescription ?? `${referralPromo.ownerCashbackPercent}% кешбэка владельцу`}</div>
                            <div className="muted">Статус: {referralPromo.isActive ? "активен" : "отключён"}</div>
                          </div>
                        ) : <div className="muted">Реферальный промокод ещё не создан.</div>}
                      </div>
                    </div>
                  ) : null}

                  {activePanel === "orders" ? (
                    <div className="admin-clients-overlay-body">
                      <div className="card" style={{ padding: 16 }}>
                        <div className="section-label" style={{ marginBottom: 8 }}>История покупок</div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {selectedClient.orders.length > 0 ? selectedClient.orders.map((order) => (
                            <Link key={order.id} href={buildOrdersHref(selectedClient.id)} className="card" style={{ padding: 14, textDecoration: "none", color: "inherit" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                                <div>
                                  <strong>Заказ #{order.orderNumber ?? order.id.slice(-6)}</strong>
                                  <div className="muted">{order.createdAt.toLocaleString("ru-RU")}</div>
                                </div>
                                <span className="pill pill-muted pill-compact">{formatOrderStatus(order.status)}</span>
                              </div>
                              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 12 }}>
                                <span className="muted">{inferCustomerSource({ telegramId: selectedClient.telegramId, orders: [order] }).label}</span>
                                <strong>{formatCurrency(Number(order.total))}</strong>
                              </div>
                            </Link>
                          )) : <div className="muted">У клиента пока нет заказов.</div>}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activePanel === "points" ? (
                    <div className="admin-clients-overlay-body admin-clients-points-layout">
                      <section className="card" style={{ padding: 16 }}>
                        <div className="section-label">Баллы</div>
                        <h3 style={{ marginBottom: 12 }}>Начислить или списать</h3>
                        <form action={adjustCustomerPointsAction} className="form-grid">
                          <input type="hidden" name="userId" value={selectedClient.id} />
                          <label className="field">
                            <span>Операция</span>
                            <select name="direction" defaultValue="credit">
                              <option value="credit">Начислить</option>
                              <option value="debit">Списать</option>
                            </select>
                          </label>
                          <label className="field">
                            <span>Баллы</span>
                            <input name="amount" inputMode="numeric" placeholder="100" required />
                          </label>
                          <label className="field field-wide">
                            <span>Комментарий</span>
                            <input name="note" placeholder="Причина операции" />
                          </label>
                          <div className="actions field-wide">
                            <button className="button button-primary" type="submit">Сохранить изменение</button>
                          </div>
                        </form>
                      </section>

                      <section className="card" style={{ padding: 16 }}>
                        <div className="section-label">Последние операции</div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {selectedClient.pointTransactions.length > 0 ? selectedClient.pointTransactions.map((entry) => (
                            <div key={entry.id} className="card" style={{ padding: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                                <strong>{formatSignedPoints(entry.amount)} баллов</strong>
                                <span className="muted">{entry.createdAt.toLocaleString("ru-RU")}</span>
                              </div>
                              <div className="muted" style={{ marginTop: 6 }}>{entry.description}</div>
                            </div>
                          )) : <div className="muted">История баллов пока пустая.</div>}
                        </div>
                      </section>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          );
        })()
      ) : null}
    </main>
  );
}