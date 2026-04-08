import { redirect } from "next/navigation";
import { isMarketingMode } from "../../../../lib/auth/marketing";
import { getMarketingStats } from "./actions";

type PageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function AdminMarketingPage({ searchParams }: PageProps) {
  const marketingMode = await isMarketingMode();

  if (!marketingMode) {
    redirect("/admin");
  }

  const params = await searchParams;
  const period = ([7, 30, 90] as const).includes(Number(params.period) as 7 | 30 | 90)
    ? (Number(params.period) as 7 | 30 | 90)
    : 30;

  const stats = await getMarketingStats(period);
  const maxChannelTotal = Math.max(...stats.channels.map((c) => c.total), 1);
  const maxCampaignCount = Math.max(...stats.campaigns.map((c) => c.count), 1);

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">📊 Маркетинг</div>
        <h1>Аналитика конверсий по каналам и кампаниям</h1>
        <p>
          Данные по заказам, trade-in и сервисным заявкам за выбранный период. Источник — атрибуция из UTM-меток и Yandex YCLID.
        </p>
      </section>

      {/* Переключатель периода */}
      <section style={{ marginTop: 18, display: "flex", gap: 8 }}>
        {([7, 30, 90] as const).map((d) => (
          <a
            key={d}
            href={`/admin/marketing?period=${d}`}
            className={`button button-sm ${d === period ? "button-primary" : "button-secondary"}`}
          >
            {d} дней
          </a>
        ))}
      </section>

      {/* KPI */}
      <section style={{ marginTop: 18 }} className="grid grid-4">
        <div className="card glass admin-kpi-card">
          <div className="section-label">Заказы</div>
          <div className="stat">{stats.totalOrders}</div>
        </div>
        <div className="card glass admin-kpi-card">
          <div className="section-label">Trade-in заявки</div>
          <div className="stat">{stats.totalTradeIn}</div>
        </div>
        <div className="card glass admin-kpi-card">
          <div className="section-label">Сервис заявки</div>
          <div className="stat">{stats.totalService}</div>
        </div>
        <div className="card glass admin-kpi-card">
          <div className="section-label">С Yandex YCLID</div>
          <div className="stat">{stats.yclidOrders}</div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            заказов с Яндекс Директ
          </p>
        </div>
      </section>

      {/* Каналы */}
      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Конверсии по каналам</div>
        {stats.channels.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Нет данных за период</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {stats.channels.map((ch) => (
              <div key={ch.channel} style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 12, alignItems: "center" }}>
                <strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ch.channel}
                </strong>
                <div style={{ display: "flex", gap: 2, height: 24, alignItems: "flex-end" }}>
                  {ch.orders > 0 && (
                    <div
                      style={{
                        height: "100%",
                        width: `${(ch.orders / maxChannelTotal) * 100}%`,
                        minWidth: 4,
                        background: "var(--accent)",
                        borderRadius: "var(--radius-sm)",
                        transition: "width 0.3s",
                      }}
                      title={`Заказы: ${ch.orders}`}
                    />
                  )}
                  {ch.tradeIn > 0 && (
                    <div
                      style={{
                        height: "100%",
                        width: `${(ch.tradeIn / maxChannelTotal) * 100}%`,
                        minWidth: 4,
                        background: "var(--orange)",
                        borderRadius: "var(--radius-sm)",
                        transition: "width 0.3s",
                      }}
                      title={`Trade-in: ${ch.tradeIn}`}
                    />
                  )}
                  {ch.service > 0 && (
                    <div
                      style={{
                        height: "100%",
                        width: `${(ch.service / maxChannelTotal) * 100}%`,
                        minWidth: 4,
                        background: "var(--green)",
                        borderRadius: "var(--radius-sm)",
                        transition: "width 0.3s",
                      }}
                      title={`Сервис: ${ch.service}`}
                    />
                  )}
                </div>
                <span style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {ch.orders}з / {ch.tradeIn}t / {ch.service}с = {ch.total}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} /> Заказы
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--orange)", display: "inline-block" }} /> Trade-in
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--green)", display: "inline-block" }} /> Сервис
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Топ кампании */}
      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Топ UTM-кампании по заказам</div>
        {stats.campaigns.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Нет данных за период</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {stats.campaigns.map((c) => (
              <div key={c.campaign} style={{ display: "grid", gridTemplateColumns: "200px 1fr 60px", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.campaign}
                </span>
                <div style={{ height: 20, background: "var(--bg)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(c.count / maxCampaignCount) * 100}%`,
                      minWidth: 4,
                      background: "var(--accent)",
                      borderRadius: "var(--radius-sm)",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right" }}>{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
