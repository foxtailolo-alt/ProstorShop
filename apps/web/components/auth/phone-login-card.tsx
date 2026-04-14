"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  redirectTo?: string;
};

export function PhoneLoginCard({ redirectTo = "/" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body: Record<string, string> = {
        action: mode,
        phone,
        password,
        redirectTo,
      };

      if (mode === "register") {
        body.firstName = firstName;
      }

      const response = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Ошибка авторизации.");
        return;
      }

      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setError("Не удалось подключиться к серверу.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card glass">
      <div className="section-label">
        {mode === "login" ? "Вход по телефону" : "Регистрация"}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {mode === "register" && (
          <input
            type="text"
            placeholder="Имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="admin-inline-input"
            autoComplete="given-name"
          />
        )}

        <input
          type="tel"
          placeholder="+7 999 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="admin-inline-input"
          autoComplete="tel"
        />

        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="admin-inline-input"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />

        {error && (
          <div style={{ color: "var(--danger, #d33)", fontSize: 13 }}>{error}</div>
        )}

        <button className="button button-primary" type="submit" disabled={loading}>
          {loading
            ? "Подождите..."
            : mode === "login"
              ? "Войти"
              : "Зарегистрироваться"}
        </button>
      </form>

      <div style={{ marginTop: 12, fontSize: 13, textAlign: "center" }}>
        {mode === "login" ? (
          <span>
            Нет аккаунта?{" "}
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              style={{ border: "none", background: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
            >
              Зарегистрируйтесь
            </button>
          </span>
        ) : (
          <span>
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              style={{ border: "none", background: "none", color: "var(--accent)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
            >
              Войти
            </button>
          </span>
        )}
      </div>
    </section>
  );
}
