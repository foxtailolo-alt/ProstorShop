import Link from "next/link";
import { StoreNav } from "../../../components/layout/store-nav";
import { TelegramLoginWidget } from "../../../components/auth/telegram-login-widget";
import { getCurrentUserProfile } from "../../../lib/profile";

const statusLabels: Record<string, string> = {
  pending: "Новая",
  contacted: "Связались",
  confirmed: "Подтверждена",
  completed: "Завершена",
  cancelled: "Отменена",
};

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || "Пользователь";
  const displayPhone = profile?.phone || profile?.orders.find((order) => order.phone)?.phone || "Добавится после первого заказа";
  const canOpenAdmin = Boolean(profile?.roles.some((role) => role !== "customer"));

  return (
    <main className="page shell">
      <StoreNav />
      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Профиль</h1>
      </section>

      {!profile ? (
        <section className="store-section">
          <div className="glass" style={{ padding: 24, display: "grid", gap: 16 }}>
            <h2>Вход через Telegram</h2>
            <p className="muted">
              Авторизуйтесь, чтобы увидеть историю заказов, баланс баллов и свой реферальный промокод.
            </p>
            <TelegramLoginWidget redirectToDefault="/profile" />
          </div>
        </section>
      ) : (
        <section className="store-section">
          <div className="cart-layout">
            <div className="glass" style={{ padding: 24, display: "grid", gap: 18 }}>
              <div>
                <h2 style={{ marginBottom: 6 }}>{displayName}</h2>
                <div className="muted">Телефон: {displayPhone}</div>
                {profile.username ? <div className="muted">@{profile.username}</div> : null}
              </div>

              <div className="glass" style={{ padding: 18, display: "grid", gap: 8 }}>
                <div className="section-label">Баланс</div>
                <strong style={{ fontSize: "2rem" }}>{profile.loyaltyPoints} баллов</strong>
                <div className="muted">За завершённые заказы начисляется 1% кешбэка баллами.</div>
              </div>

              <div className="glass" style={{ padding: 18, display: "grid", gap: 8 }}>
                <div className="section-label">Ваш промокод</div>
                <strong style={{ fontSize: "1.4rem" }}>{profile.referralPromoCode?.code ?? "Будет создан автоматически"}</strong>
                <div className="muted">
                  {profile.referralPromoCode?.rewardDescription ?? "Промокод появится после первой авторизации."}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="button button-primary" href="/catalog">Перейти в каталог</Link>
                {canOpenAdmin ? <Link className="button button-secondary" href="/admin">Открыть админку</Link> : null}
                <form action="/api/auth/logout" method="post">
                  <button className="button button-secondary" type="submit">Выйти</button>
                </form>
              </div>
            </div>

            <div className="glass" style={{ padding: 24, display: "grid", gap: 18 }}>
              <h2>История покупок</h2>
              {profile.orders.length === 0 ? (
                <p className="muted">Пока нет заказов. После первой покупки здесь появится история.</p>
              ) : (
                profile.orders.map((order) => (
                  <div key={order.id} className="glass" style={{ padding: 18, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>Заказ {order.id}</strong>
                      <span className="muted">{statusLabels[order.status] ?? order.status}</span>
                    </div>
                    <div className="muted">{order.createdAt.toLocaleString("ru-RU")}</div>
                    <div className="muted">Сумма: {order.total.toLocaleString("ru-RU")} ₽</div>
                    {order.promoCode ? (
                      <div className="muted">
                        Промокод: {order.promoCode}
                        {order.promoRewardDescription ? ` (${order.promoRewardDescription})` : ""}
                      </div>
                    ) : null}
                    <div style={{ display: "grid", gap: 6 }}>
                      {order.items.map((item) => (
                        <div key={item.id} className="muted">
                          {item.name}
                          {item.variantLabel ? ` (${item.variantLabel})` : ""} x {item.quantity}
                          {` — ${item.price.toLocaleString("ru-RU")} ₽`}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}