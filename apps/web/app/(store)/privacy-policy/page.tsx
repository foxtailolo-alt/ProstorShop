import { StoreNav } from "../../../components/layout/store-nav";
import { businessProfile, privacyPolicySections } from "../../../lib/legal";

export default function PrivacyPolicyPage() {
  return (
    <main className="page shell legal-page">
      <StoreNav />

      <section className="legal-card glass animate-fade-up">
        <span className="section-label">Юридическая информация</span>
        <h1 className="store-page-title">Политика конфиденциальности</h1>
        <p className="legal-lead">
          Документ определяет порядок обработки персональных данных на сайте магазина {businessProfile.brandName}.
        </p>
        <div className="legal-meta">
          <span>{businessProfile.proprietorName}</span>
          <span>ИНН {businessProfile.inn}</span>
          <span>ОГРНИП {businessProfile.ogrnip}</span>
        </div>

        <div className="legal-sections">
          {privacyPolicySections.map((section) => (
            <section key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}