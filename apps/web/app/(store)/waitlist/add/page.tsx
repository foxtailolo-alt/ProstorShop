import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreNav } from "../../../../components/layout/store-nav";
import { getSession } from "../../../../lib/auth/session";
import { getActiveTradeInSnapshot } from "../../../../lib/data/pricing";
import { TradeInWizard } from "../../trade-in/trade-in-wizard";

export default async function AddWaitlistEntryPage() {
  const [session, snapshot] = await Promise.all([getSession(), getActiveTradeInSnapshot()]);

  if (!session) {
    redirect("/profile");
  }

  return (
    <main className="page shell">
      <StoreNav />
      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Список ожидания</h1>
        <p className="store-page-subtitle">
          Сохраните точную модель и нужные параметры. Когда такой trade-in вариант появится, мы покажем его в вашем профиле.
        </p>
      </section>

      <section className="store-section">
        {snapshot ? (
          <TradeInWizard snapshot={snapshot} canSaveToProfile mode="waitlist" />
        ) : (
          <div className="card glass">
            <h2>Snapshot пока недоступен</h2>
            <p className="muted">Сначала обновите trade-in snapshot в админке, затем повторите добавление в список ожидания.</p>
            <div className="actions">
              <Link className="button button-secondary" href="/profile">Вернуться в профиль</Link>
              <Link className="button button-primary" href="/trade-in">Открыть Trade-in</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}