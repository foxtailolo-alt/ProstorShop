"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductModal } from "./product-modal";
import { ConfirmButton } from "../../../../components/admin/confirm-button";
import { GlassSelect } from "../../../../components/store/glass-select";

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
  const filtersFormRef = useRef<HTMLFormElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const statusInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialProduct = editSku
    ? products.find((p) => p.sku === editSku) ?? null
    : null;

  const [modalOpen, setModalOpen] = useState(!!editSku);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(initialProduct);
  const [notice, setNotice] = useState(saveMessage);
  const [pendingSavedSku, setPendingSavedSku] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(searchQuery);
  const [categoryDraft, setCategoryDraft] = useState(selectedCategorySlug);
  const [statusDraft, setStatusDraft] = useState(selectedStatus);

  const categorySelectOptions = [
    { value: "", label: "Все категории" },
    ...categoryFilterOptions.map((option) => ({ value: option.slug, label: option.label })),
  ];
  const statusSelectOptions = [
    { value: "all", label: "Все" },
    { value: "in-stock", label: "В наличии" },
    { value: "out-of-stock", label: "Нет в наличии" },
    { value: "with-photo", label: "С фото" },
    { value: "without-photo", label: "Без фото" },
  ];

  useEffect(() => {
    setNotice(saveMessage);
  }, [saveMessage]);

  useEffect(() => {
    setSearchDraft(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setCategoryDraft(selectedCategorySlug);
  }, [selectedCategorySlug]);

  useEffect(() => {
    setStatusDraft(selectedStatus);
  }, [selectedStatus]);

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

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

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

  function submitFilters() {
    filtersFormRef.current?.requestSubmit();
  }

  function handleFilterChange() {
    submitFilters();
  }

  function handleCategoryChange(nextValue: string) {
    setCategoryDraft(nextValue);

    if (categoryInputRef.current) {
      categoryInputRef.current.value = nextValue;
    }

    handleFilterChange();
  }

  function handleStatusChange(nextValue: string) {
    setStatusDraft(nextValue);

    if (statusInputRef.current) {
      statusInputRef.current.value = nextValue;
    }

    handleFilterChange();
  }

  function handleSearchChange(nextValue: string) {
    setSearchDraft(nextValue);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      submitFilters();
    }, 350);
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
        <form ref={filtersFormRef} action="/admin/products" method="get" className="admin-products-toolbar card glass">
          <input ref={categoryInputRef} type="hidden" name="category" value={categoryDraft} readOnly />
          <input ref={statusInputRef} type="hidden" name="status" value={statusDraft} readOnly />
          <div className="admin-products-toolbar-left">
            <button className="button button-primary button-sm" type="button" onClick={openNew}>
              Новый товар
            </button>
            <div className="admin-products-found">Найдено: <strong>{totalCount}</strong></div>
          </div>
          <div className="admin-products-toolbar-right">
            <div className="admin-products-filters-row">
              <label className="admin-products-filter-field">
                <span className="admin-products-filter-label">Категория</span>
                <GlassSelect
                  value={categoryDraft}
                  options={categorySelectOptions}
                  onChange={handleCategoryChange}
                  placeholder="Все категории"
                />
              </label>
              <label className="admin-products-filter-field admin-products-filter-field-small">
                <span className="admin-products-filter-label">Статус</span>
                <GlassSelect
                  value={statusDraft}
                  options={statusSelectOptions}
                  onChange={handleStatusChange}
                  placeholder="Все"
                />
              </label>
            </div>
            <label className="admin-products-filter-field admin-products-search-field">
              <span className="admin-products-filter-label">Поиск</span>
              <input
                type="search"
                name="q"
                value={searchDraft}
                placeholder="Поиск"
                className="field admin-products-search"
                onChange={(event) => handleSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                    submitFilters();
                  }
                }}
              />
            </label>
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
