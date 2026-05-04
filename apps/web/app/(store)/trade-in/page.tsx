import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreNav } from "../../../components/layout/store-nav";
import { getRuntimeFeatureFlags } from "../../../lib/data/catalog";
import { getActiveTradeInSnapshot, listTradeInRules } from "../../../lib/data/pricing";
import { TradeInCalculator } from "./trade-in-calculator";
import { TradeInWizard } from "./trade-in-wizard";

type TradeInPageProps = {
  searchParams?: Promise<{
    success?: string;
    requestId?: string;
  }>;
};

export default async function TradeInPage({ searchParams }: TradeInPageProps) {
  const [rules, activeSnapshot, featureFlags] = await Promise.all([listTradeInRules(), getActiveTradeInSnapshot(), getRuntimeFeatureFlags()]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const success = resolvedSearchParams?.success === "1";
  const requestId = resolvedSearchParams?.requestId?.trim();

  if (!featureFlags.tradeInEnabled) {
    notFound();
  }

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Trade-in</h1>
        <p className="store-page-subtitle">
          Сдайте старое устройство и получите скидку на новую покупку. Узнайте стоимость вашего устройства за 30 секунд.
        </p>
      </section>

      {success ? (
        <section className="store-section">
          <div className="success-banner glass">
            <h2>Заявка отправлена!</h2>
            <p>Номер заявки: {requestId ?? "—"}. Мы свяжемся с вами в ближайшее время для уточнения деталей.</p>
            <Link className="button button-primary" href="/catalog">Перейти в каталог</Link>
          </div>
        </section>
      ) : (
        <section className="store-section">
          {activeSnapshot ? <TradeInWizard snapshot={activeSnapshot} /> : <TradeInCalculator rules={rules} />}
        </section>
      )}

      <section className="store-section">
        <div className="grid grid-3">
          <div className="advantage-card glass animate-fade-up delay-1">
            <span className="advantage-icon">📱</span>
            <strong>Принимаем любые устройства</strong>
            <p>iPhone, Samsung, MacBook и другую технику в любом состоянии</p>
          </div>
          <div className="advantage-card glass animate-fade-up delay-2">
            <span className="advantage-icon">⚡</span>
            <strong>Быстрая оценка</strong>
            <p>Узнайте стоимость устройства онлайн, без визита в магазин</p>
          </div>
          <div className="advantage-card glass animate-fade-up delay-3">
            <span className="advantage-icon">💸</span>
            <strong>Выгодные условия</strong>
            <p>Честная цена за ваше устройство и скидка на новую покупку</p>
          </div>
        </div>
      </section>
    </main>
  );
}