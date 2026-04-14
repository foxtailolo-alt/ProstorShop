"use client";

import { useState, useRef } from "react";
import type { CategoryTreeNode } from "../../../../lib/data/catalog";
import { upsertCategoryAction, deleteCategoryAction } from "./actions";
import { ConfirmButton } from "../../../../components/admin/confirm-button";

const cyrMap: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",
  л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",
  ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((ch) => cyrMap[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Props = {
  tree: CategoryTreeNode[];
};

function buildFlatOptions(
  nodes: CategoryTreeNode[],
  prefix: string,
  excludeIds?: Set<string>,
): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [];
  for (const node of nodes) {
    if (excludeIds?.has(node.id)) continue;
    const label = prefix ? `${prefix} / ${node.name}` : node.name;
    options.push({ id: node.id, label });
    options.push(...buildFlatOptions(node.children, label, excludeIds));
  }
  return options;
}

function findNode(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function collectDescendantIds(node: CategoryTreeNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectDescendantIds(child)) ids.add(id);
  }
  return ids;
}

function TreeItem({
  node,
  depth,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: {
  node: CategoryTreeNode;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <>
      <div
        className={`admin-tree-node${isSelected ? " admin-tree-node-selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        <button
          type="button"
          className="admin-tree-toggle"
          onClick={() => hasChildren && onToggle(node.id)}
          aria-label={hasChildren ? (isExpanded ? "Свернуть" : "Развернуть") : undefined}
        >
          {hasChildren ? (isExpanded ? "−" : "+") : " "}
        </button>
        <span className="admin-tree-icon">📁</span>
        <button
          type="button"
          className="admin-tree-name"
          onClick={() => onSelect(node.id)}
        >
          {node.name}
        </button>
      </div>
      {hasChildren && isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            selectedId={selectedId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function CategoryForm({
  category,
  parentId,
  parentOptions,
  onCancel,
}: {
  category?: CategoryTreeNode;
  parentId?: string | null;
  parentOptions: { id: string; label: string }[];
  onCancel?: () => void;
}) {
  const isEdit = Boolean(category);
  const slugRef = useRef<HTMLInputElement>(null);
  const seoTitleRef = useRef<HTMLInputElement>(null);
  const seoDescRef = useRef<HTMLInputElement>(null);
  const seoKeywordsRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLSelectElement>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function getParentPath(): string {
    const selectedParentId = parentRef.current?.value;
    if (!selectedParentId) return "";
    const opt = parentOptions.find((o) => o.id === selectedParentId);
    return opt?.label ?? "";
  }

  async function fillSeoWithAI() {
    const name = nameRef.current?.value?.trim();
    if (!name) { setAiError("Сначала введите название категории"); return; }

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryName: name, parentPath: getParentPath() }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error ?? "Ошибка ИИ"); return; }

      if (seoTitleRef.current) seoTitleRef.current.value = data.seoTitle ?? "";
      if (seoDescRef.current) seoDescRef.current.value = data.seoDescription ?? "";
      if (seoKeywordsRef.current && Array.isArray(data.seoKeywords)) {
        seoKeywordsRef.current.value = data.seoKeywords.join(", ");
      }
    } catch {
      setAiError("Не удалось подключиться к серверу");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="card glass admin-category-card">
      <div className="section-label">
        {isEdit ? `Редактирование: ${category!.name}` : "Новая категория"}
      </div>
      <form action={upsertCategoryAction} className="admin-tree-form">
        {category && <input type="hidden" name="categoryId" value={category.id} />}
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">Название</span>
          <input
            ref={nameRef}
            name="name"
            type="text"
            placeholder="Название"
            defaultValue={category?.name ?? ""}
            required
            className="admin-inline-input"
            onChange={(e) => {
              if (!slugTouched && slugRef.current) {
                slugRef.current.value = toSlug(e.target.value);
              }
            }}
          />
        </label>
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">Slug</span>
          <input
            ref={slugRef}
            name="slug"
            type="text"
            placeholder="auto"
            defaultValue={category?.slug ?? ""}
            className="admin-inline-input admin-inline-input-sm"
            onChange={() => setSlugTouched(true)}
          />
        </label>
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">Родительская категория</span>
          <select
            ref={parentRef}
            name="parentId"
            defaultValue={category?.parentId ?? parentId ?? ""}
            className="admin-inline-input"
          >
            <option value="">/</option>
            {parentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span className="admin-tree-field-label" style={{ margin: 0 }}>SEO</span>
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={fillSeoWithAI}
            disabled={aiLoading}
            style={{ fontSize: 12 }}
          >
            {aiLoading ? "ИИ думает..." : "🤖 Заполнить с ИИ"}
          </button>
        </div>
        {aiError && <div style={{ color: "var(--danger, #d33)", fontSize: 13 }}>{aiError}</div>}
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">SEO Title</span>
          <input
            ref={seoTitleRef}
            name="seoTitle"
            type="text"
            placeholder="SEO заголовок"
            defaultValue={category?.seoTitle ?? ""}
            className="admin-inline-input"
          />
        </label>
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">SEO Description</span>
          <input
            ref={seoDescRef}
            name="seoDescription"
            type="text"
            placeholder="SEO описание"
            defaultValue={category?.seoDescription ?? ""}
            className="admin-inline-input"
          />
        </label>
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">SEO Keywords</span>
          <input
            ref={seoKeywordsRef}
            name="seoKeywords"
            type="text"
            placeholder="ключевые фразы через запятую"
            defaultValue={category?.seoKeywords?.join(", ") ?? ""}
            className="admin-inline-input"
          />
        </label>
        {category && (
          <div className="admin-tree-info">
            <span className="pill pill-compact pill-muted">{category.productCount} товаров</span>
            <span className="pill pill-compact">{category.childCount} подкатегорий</span>
          </div>
        )}
        <div className="admin-tree-actions">
          <button className="button button-primary button-sm" type="submit">
            {isEdit ? "Сохранить" : "Создать"}
          </button>
          {onCancel && (
            <button type="button" className="button button-secondary button-sm" onClick={onCancel}>
              Отмена
            </button>
          )}
        </div>
      </form>
      {category && (
        <div className="admin-tree-actions" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
          <form action={deleteCategoryAction} style={{ display: "inline" }}>
            <input type="hidden" name="categoryId" value={category.id} />
            <ConfirmButton message={`Удалить «${category.name}»?`} className="button button-secondary button-sm">
              Удалить
            </ConfirmButton>
          </form>
        </div>
      )}
    </div>
  );
}

export function CategoryManager({ tree }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectCategory(id: string) {
    setSelectedId(id);
    setCreating(false);
  }

  function startCreate(parentId: string | null = null) {
    setCreateParentId(parentId);
    setCreating(true);
    setSelectedId(null);
  }

  const selectedNode = selectedId ? findNode(tree, selectedId) : null;

  // Exclude selected node and its descendants from parent picker when editing
  const editExcludeIds = selectedNode ? collectDescendantIds(selectedNode) : new Set<string>();
  const editParentOptions = buildFlatOptions(tree, "", editExcludeIds);

  // For create mode, all categories are available as parents
  const createParentOptions = buildFlatOptions(tree, "");

  return (
    <div className="admin-tree-layout">
      <div className="admin-tree-sidebar">
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="button button-primary button-sm" onClick={() => startCreate(null)}>
            Новая категория
          </button>
          {selectedNode && (
            <button className="button button-secondary button-sm" onClick={() => startCreate(selectedNode.id)}>
              + подкатегория
            </button>
          )}
        </div>
        <div className="admin-tree-list">
          {tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={toggleExpand}
              onSelect={selectCategory}
            />
          ))}
          {tree.length === 0 && (
            <div className="muted" style={{ padding: 16 }}>Нет категорий</div>
          )}
        </div>
      </div>
      <div className="admin-tree-detail">
        {creating ? (
          <CategoryForm
            key={`create-${createParentId}`}
            parentId={createParentId}
            parentOptions={createParentOptions}
            onCancel={() => setCreating(false)}
          />
        ) : selectedNode ? (
          <CategoryForm
            key={selectedNode.id}
            category={selectedNode}
            parentOptions={editParentOptions}
          />
        ) : (
          <div className="card glass" style={{ padding: 24, textAlign: "center" }}>
            <p className="muted">Выберите категорию или создайте новую</p>
          </div>
        )}
      </div>
    </div>
  );
}
