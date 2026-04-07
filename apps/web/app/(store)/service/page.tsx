import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreNav } from "../../../components/layout/store-nav";
import { getRuntimeFeatureFlags } from "../../../lib/data/catalog";
import { listServicePriceRows } from "../../../lib/data/pricing";
import { ServiceCalculator } from "./service-calculator";

type ServicePageProps = {
  searchParams?: Promise<{
    success?: string;
    requestId?: string;
  }>;
};

export default async function ServicePage({ searchParams }: ServicePageProps) {
  const [servicePriceRows, featureFlags] = await Promise.all([
    listServicePriceRows(),
    getRuntimeFeatureFlags(),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const success = resolvedSearchParams?.success === "1";
  const requestId = resolvedSearchParams?.requestId?.trim();

  if (!featureFlags.serviceEnabled) {
    notFound();
  }

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Сервис и ремонт</h1>
        <p className="store-page-subtitle">
          Ремонт iPhone, Samsung, MacBook и iPad. Узнайте стоимость ремонта онлайн и оставьте заявку.
        </p>
      </section>

      {success ? (
        <section className="store-section">
          <div className="success-banner glass">
            <h2>Заявка на ремонт отправлена!</h2>
            <p>Номер заявки: {requestId ?? "—"}. Мы свяжемся с вами для согласования времени и деталей.</p>
            <Link className="button button-primary" href="/catalog">Перейти в каталог</Link>
          </div>
        </section>
      ) : (
        <section className="store-section">
          <ServiceCalculator rows={servicePriceRows} />
        </section>
      )}

      <section className="store-section">
        <div className="grid grid-3">
          <div className="advantage-card glass animate-fade-up delay-1">
            <span className="advantage-icon">🔧</span>
            <strong>Опытные мастера</strong>
            <p>Ремонт любой сложности с использованием качественных комплектующих</p>
          </div>
          <div className="advantage-card glass animate-fade-up delay-2">
            <span className="advantage-icon">📋</span>
            <strong>Прозрачные цены</strong>
            <p>Вы заранее знаете стоимость ремонта, без скрытых доплат</p>
          </div>
          <div className="advantage-card glass animate-fade-up delay-3">
            <span className="advantage-icon">⏰</span>
            <strong>Быстрый ремонт</strong>
            <p>Большинство ремонтов выполняется в день обращения</p>
          </div>
        </div>
      </section>
    </main>
  );
}