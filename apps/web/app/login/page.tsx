import { redirect } from "next/navigation";
import { BootstrapLoginCard } from "../../components/auth/bootstrap-login-card";
import { DevLoginCard } from "../../components/auth/dev-login-card";
import { PhoneLoginCard } from "../../components/auth/phone-login-card";
import { TelegramLoginWidget } from "../../components/auth/telegram-login-widget";
import { getSession, isAdminSession } from "../../lib/auth/session";
import { getAttributionEntries, getAttributionSnapshot } from "../../lib/attribution";

function getLocalAdminIds() {
  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string;
    bootstrapError?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, attribution] = await Promise.all([getSession(), getAttributionSnapshot()]);
  const params = await searchParams;
  const target = params.redirect?.startsWith("/") ? params.redirect : "/admin";
  const bootstrapError = typeof params.bootstrapError === "string" ? params.bootstrapError : undefined;
  const attributionEntries = getAttributionEntries(attribution);
  const localAdminIds = getLocalAdminIds();

  if (isAdminSession(session)) {
    redirect(target as "/admin");
  }

  return (
    <main className="page shell">
      <section className="hero glass">
        <div className="section-label">Авторизация</div>
        <h1>Вход в Простор</h1>
        <p>
          Войдите через Telegram или по номеру телефона.
          Один аккаунт для клиента, Mini App и админки.
        </p>
        {attributionEntries.length > 0 ? (
          <div className="actions">
            {attributionEntries.map((entry) => (
              <div key={entry.label} className="pill">
                {entry.label}: {entry.value}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="auth-row" style={{ marginTop: 18 }}>
        <PhoneLoginCard redirectTo={target} />
        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="muted auth-divider-text">или</span>
          <div className="auth-divider-line" />
        </div>
        <TelegramLoginWidget redirectToDefault="/admin" />
      </div>

      <div style={{ marginTop: 18 }}>
        <BootstrapLoginCard redirectTo={target} error={bootstrapError} />
      </div>

      <div style={{ marginTop: 18 }}>
        <DevLoginCard redirectTo={target} adminIds={localAdminIds} />
      </div>
    </main>
  );
}