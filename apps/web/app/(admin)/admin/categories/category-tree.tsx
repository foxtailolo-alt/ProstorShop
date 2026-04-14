"use client";

import { useState } from "react";
import type { CategoryTreeNode } from "../../../../lib/data/catalog";
import { upsertCategoryAction, deleteCategoryAction } from "./actions";
import { ConfirmButton } from "../../../../components/admin/confirm-button";

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
            name="name"
            type="text"
            placeholder="Название"
            defaultValue={category?.name ?? ""}
            required
            className="admin-inline-input"
          />
        </label>
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">Slug</span>
          <input
            name="slug"
            type="text"
            placeholder="auto"
            defaultValue={category?.slug ?? ""}
            className="admin-inline-input admin-inline-input-sm"
          />
        </label>
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">Родительская категория</span>
          <select
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
        <label className="admin-tree-field">
          <span className="admin-tree-field-label">SEO Title</span>
          <input
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
            name="seoDescription"
            type="text"
            placeholder="SEO описание"
            defaultValue={category?.seoDescription ?? ""}
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
