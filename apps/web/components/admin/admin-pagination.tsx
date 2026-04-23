import Link from "next/link";

type AdminSearchProps = {
  basePath: string;
  query: string;
  placeholder?: string;
};

export function AdminSearch({ basePath, query, placeholder = "Поиск..." }: AdminSearchProps) {
  return (
    <form action={basePath} method="get" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <input
        type="text"
        name="q"
        defaultValue={query}
        placeholder={placeholder}
        className="field"
        style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", fontSize: 14 }}
      />
      <button type="submit" className="button button-primary button-sm">Найти</button>
      {query && (
        <Link href={basePath as "/"} className="button button-secondary button-sm">Сбросить</Link>
      )}
    </form>
  );
}

type AdminPaginationProps = {
  basePath: string;
  currentPage: number;
  totalPages: number;
  searchQuery?: string;
  extraParams?: Record<string, string | null | undefined>;
};

export function AdminPagination({ basePath, currentPage, totalPages, searchQuery, extraParams }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        if (value) {
          params.set(key, value);
        }
      }
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return (qs ? `${basePath}?${qs}` : basePath) as "/";
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 16 }}>
      {currentPage > 1 && (
        <Link href={buildHref(currentPage - 1)} className="button button-secondary button-sm">← Назад</Link>
      )}
      <span style={{ fontSize: 13, color: "var(--muted)" }}>
        {currentPage} / {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link href={buildHref(currentPage + 1)} className="button button-secondary button-sm">Вперёд →</Link>
      )}
    </div>
  );
}

export const PAGE_SIZE = 20;
