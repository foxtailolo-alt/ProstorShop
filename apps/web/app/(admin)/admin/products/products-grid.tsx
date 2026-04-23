"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductModal } from "./product-modal";
import { ConfirmButton } from "../../../../components/admin/confirm-button";

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  price: number;
};

type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  description: string | null;
  inStock: boolean;
  imageUrl: string | null;
  imageUrls: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  specs: Record<string, string>;
  options: import("./product-options-editor").ProductOptionsData;
  category: { slug: string; name: string };
  categoryPath: string;
  recommendedIds: string[];
};

type Props = {
  products: ProductRecord[];
  categories: CategoryNode[];
  allProductOptions: ProductOption[];
  categoryFilterOptions: Array<{ slug: string; label: string }>;
  totalCount: number;
  searchQuery: string;
  selectedCategorySlug: string;
  selectedStatus: string;
  editSku: string | null;
  saveMessage: string | null;
  upsertAction: (
    state: { error: string | null; savedSku: string | null; successMessage: string | null; savedAt: number | null },
    formData: FormData,
  ) => Promise<{ error: string | null; savedSku: string | null; successMessage: string | null; savedAt: number | null }>;
  toggleStockAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
};

export function ProductsGrid({
  products,
  categories,
  allProductOptions,
  categoryFilterOptions,
  totalCount,
  searchQuery,
  selectedCategorySlug,
  selectedStatus,
  editSku,
  saveMessage,
  upsertAction,
  toggleStockAction,
  deleteAction,
}: Props) {
  const initialProduct = editSku
    ? products.find((p) => p.sku === editSku) ?? null
    : null;

  const [modalOpen, setModalOpen] = useState(!!editSku);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(initialProduct);
  const [notice, setNotice] = useState(saveMessage);
  const [pendingSavedSku, setPendingSavedSku] = useState<string | null>(null);

  useEffect(() => {
    setNotice(saveMessage);
  }, [saveMessage]);

  useEffect(() => {
    if (!editSku) {
      return;
    }

    const nextProduct = products.find((product) => product.sku === editSku) ?? null;
    setEditingProduct(nextProduct);
    setModalOpen(Boolean(nextProduct));
  }, [editSku, products]);

  useEffect(() => {
    if (!editingProduct) {
      return;
    }

    const nextProduct = products.find((product) => product.id === editingProduct.id) ?? null;

    if (!nextProduct) {
      setEditingProduct(null);
      setModalOpen(false);
      return;
    }

    if (nextProduct !== editingProduct) {
      setEditingProduct(nextProduct);
    }
  }, [editingProduct, products]);

  useEffect(() => {
    if (!pendingSavedSku) {
      return;
    }

    const nextProduct = products.find((product) => product.sku === pendingSavedSku) ?? null;

    if (!nextProduct) {
      return;
    }

    setEditingProduct(nextProduct);
    setModalOpen(true);
    setPendingSavedSku(null);
  }, [pendingSavedSku, products]);

  function openNew() {
    setEditingProduct(null);
    setModalOpen(true);
  }

  function openEdit(product: ProductRecord) {
    setEditingProduct(product);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
  }

  function handleSaved(savedSku: string, successMessage: string) {
    setNotice(successMessage);
    setPendingSavedSku(savedSku);
    setModalOpen(true);
  }

  const modalData = editingProduct
    ? {
        id: editingProduct.id,
        sku: editingProduct.sku,
        name: editingProduct.name,
        brand: editingProduct.brand,
        price: editingProduct.price,
        description: editingProduct.description ?? "",
        inStock: editingProduct.inStock,
        categorySlug: editingProduct.category.slug,
        seoTitle: editingProduct.seoTitle ?? "",
        seoDescription: editingProduct.seoDescription ?? "",
        imageUrls: editingProduct.imageUrls,
        recommendedIds: editingProduct.recommendedIds,
        specs: editingProduct.specs,
        options: editingProduct.options,
      }
    : null;

  return (
    <>
      <section className="admin-header glass">
        <div className="admin-products-heading-row">
          <h2 style={{ margin: 0 }}>Товары</h2>
          <button className="button button-primary button-sm" type="button" onClick={openNew}>
            Новый товар
          </button>
        </div>
      </section>

      {notice ? (
        <section style={{ marginTop: 16 }}>
          <div className="added-notice glass">
            <span>{notice}</span>
            <Link href="/admin/products" className="button button-secondary button-sm" onClick={() => setNotice(null)}>
              Скрыть
            </Link>
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 16 }}>
        <form action="/admin/products" method="get" className="admin-products-toolbar card glass">
          <div className="admin-products-toolbar-left">
            <button className="button button-primary button-sm" type="button" onClick={openNew}>
              Новый товар
            </button>
            <div className="admin-products-found">Найдено: <strong>{totalCount}</strong></div>
          </div>
          <div className="admin-products-toolbar-right">
            <select name="category" defaultValue={selectedCategorySlug} className="field admin-products-select">
              <option value="">Все категории</option>
              {categoryFilterOptions.map((option) => (
                <option key={option.slug} value={option.slug}>{option.label}</option>
              ))}
            </select>
            <select name="status" defaultValue={selectedStatus} className="field admin-products-select admin-products-select-small">
              <option value="all">Все</option>
              <option value="in-stock">В наличии</option>
              <option value="out-of-stock">Нет в наличии</option>
              <option value="with-photo">С фото</option>
              <option value="without-photo">Без фото</option>
            </select>
            <div className="admin-products-search-wrap">
              <input
                type="search"
                name="q"
                defaultValue={searchQuery}
                placeholder="Поиск"
                className="field admin-products-search"
              />
              <button className="button button-secondary button-sm admin-products-search-button" type="submit">⌕</button>
            </div>
          </div>
        </form>

        <div className="admin-product-grid">
          {products.map((product) => {
            const photoCount = product.imageUrls.length || (product.imageUrl ? 1 : 0);
            const summary = (product.description ?? "").trim();
            return (
              <div key={product.id} className="admin-product-card card glass">
                <div className="admin-product-card-head">
                  <button type="button" className="admin-product-card-title" onClick={() => openEdit(product)}>
                    {product.name}
                  </button>
                  <button type="button" className="admin-product-card-menu" onClick={() => openEdit(product)} title="Открыть товар">
                    ▾
                  </button>
                </div>

                <div className="admin-product-card-content">
                  <button
                    type="button"
                    className="admin-product-card-link"
                    onClick={() => openEdit(product)}
                  >
                    <div className="admin-product-card-img">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} loading="lazy" />
                      ) : (
                        <div className="admin-product-card-noimg">Нет фото</div>
                      )}
                      {photoCount > 1 && (
                        <span className="admin-product-card-count">{photoCount} фото</span>
                      )}
                    </div>
                  </button>

                  <div className="admin-product-card-body">
                    <div className="admin-product-card-category muted">{product.categoryPath}</div>
                    <div className="admin-product-card-badges-row">
                      <span className="admin-product-chip">SKU {product.sku}</span>
                      {product.inStock ? (
                        <span className="admin-product-chip admin-product-chip-success">Включен</span>
                      ) : (
                        <span className="admin-product-chip admin-product-chip-danger">Отключен</span>
                      )}
                    </div>
                    <p className="admin-product-card-summary">
                      {summary || "Описание товара не заполнено."}
                    </p>
                    <div className="admin-product-card-price">
                      Цена: {product.price.toLocaleString("ru-RU")} RUB
                    </div>
                    <div className="admin-product-card-actions admin-product-card-actions-inline">
                      <button
                        className="button button-primary button-sm"
                        type="button"
                        onClick={() => openEdit(product)}
                      >
                        Изменить
                      </button>
                      <form action={toggleStockAction} style={{ display: "inline" }}>
                        <input type="hidden" name="sku" value={product.sku} />
                        <input type="hidden" name="current" value={String(product.inStock)} />
                        <button className="button button-secondary button-sm" type="submit">
                          {product.inStock ? "Скрыть" : "Показать"}
                        </button>
                      </form>
                      <form action={deleteAction} style={{ display: "inline" }}>
                        <input type="hidden" name="sku" value={product.sku} />
                        <ConfirmButton
                          message={`Удалить «${product.name}»?`}
                          className="button button-secondary button-sm"
                        >
                          Удалить
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ProductModal
        key={editingProduct?.id ?? "new"}
        open={modalOpen}
        product={modalData}
        categories={categories}
        allProducts={allProductOptions}
        onClose={closeModal}
        onSaved={handleSaved}
        upsertAction={upsertAction}
      />
    </>
  );
}
