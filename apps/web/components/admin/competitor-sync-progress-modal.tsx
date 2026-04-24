"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CategoryProgressItem = {
  label: string;
  totalCount: number;
  processedCount: number;
  status: "pending" | "in-progress" | "completed";
};

type Props = {
  runId: string;
  isRunning: boolean;
  scopeLabel: string;
  note: string | null;
  processedRows: number;
  totalRows: number;
  categoryProgress: CategoryProgressItem[];
};

export function CompetitorSyncProgressModal({
  runId,
  isRunning,
  scopeLabel,
  note,
  processedRows,
  totalRows,
  categoryProgress,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(isRunning);

  useEffect(() => {
    if (isRunning) {
      setIsOpen(true);
    }
  }, [isRunning, runId]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      router.refresh();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isRunning, router, runId]);

  if (!isRunning || !isOpen) {
    return null;
  }

  const completedCategories = categoryProgress.filter((item) => item.status === "completed").length;
  const inProgressCategories = categoryProgress.filter((item) => item.status === "in-progress").length;
  const pendingCategories = categoryProgress.filter((item) => item.status === "pending").length;
  const totalCategoryCount = categoryProgress.length;
  const progressPercent = totalRows > 0 ? Math.min(100, Math.round((processedRows / totalRows) * 100)) : 0;

  return (
    <div className="competitor-sync-progress-backdrop">
      <div className="competitor-sync-progress-modal card glass">
        <div className="competitor-sync-progress-head">
          <div>
            <div className="section-label">Ожидание сбора цен</div>
            <h2>Сбор идет: {scopeLabel}</h2>
          </div>
          <button type="button" className="button button-secondary button-sm" onClick={() => setIsOpen(false)}>
            Скрыть
          </button>
        </div>

        <div className="competitor-sync-progress-stats">
          <div className="competitor-sync-progress-stat">
            <span>Строк обработано</span>
            <strong>{processedRows} / {totalRows}</strong>
          </div>
          <div className="competitor-sync-progress-stat">
            <span>Категорий готово</span>
            <strong>{completedCategories} / {totalCategoryCount}</strong>
          </div>
          <div className="competitor-sync-progress-stat">
            <span>В работе</span>
            <strong>{inProgressCategories}</strong>
          </div>
          <div className="competitor-sync-progress-stat">
            <span>Осталось</span>
            <strong>{pendingCategories}</strong>
          </div>
        </div>

        <div className="competitor-sync-progress-bar">
          <div className="competitor-sync-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="muted competitor-sync-progress-note">
          {note ?? "Идет подготовка категорий и карточек конкурента..."}
        </div>

        <div className="competitor-sync-progress-list">
          {categoryProgress.map((item) => (
            <div key={item.label} className="competitor-sync-progress-row">
              <div className="competitor-sync-progress-row-main">
                <strong>{item.label}</strong>
                <span className={`pill pill-compact ${item.status === "completed" ? "pill-muted" : ""}`}>
                  {item.status === "completed" ? "готово" : item.status === "in-progress" ? "в работе" : "ожидает"}
                </span>
              </div>
              <div className="muted">{item.processedCount} / {item.totalCount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}