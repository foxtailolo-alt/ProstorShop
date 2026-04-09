type BootstrapLoginCardProps = {
  redirectTo: string;
  error?: string;
};

function isBootstrapEnabled() {
  return Boolean(process.env.AUTH_BOOTSTRAP_SECRET && process.env.TELEGRAM_ADMIN_IDS);
}

export function BootstrapLoginCard({ redirectTo, error }: BootstrapLoginCardProps) {
  if (!isBootstrapEnabled()) {
    return null;
  }

  return (
    <div className="card glass auth-card">
      <div className="section-label">Резервный вход</div>
      <p>
        Временный вход для первичной настройки. Доступен только по одноразовому секрету и входит
        под владельцем из `TELEGRAM_ADMIN_IDS`.
      </p>
      <form method="post" action="/api/auth/bootstrap-login" className="auth-bootstrap-form">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input
          type="password"
          name="secret"
          placeholder="Одноразовый секрет"
          autoComplete="current-password"
          required
        />
        <button type="submit" className="button-secondary">
          Войти по секрету
        </button>
      </form>
      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}