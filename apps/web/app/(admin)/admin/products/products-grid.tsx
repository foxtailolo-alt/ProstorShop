"use client";

import { useState } from "react";
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
  recommendedIds: string[];
};

type Props = {
  products: ProductRecord[];
  categories: CategoryNode[];
  allProductOptions: ProductOption[];
  editSku: string | null;
  upsertAction: (formData: FormData) => void;
  toggleStockAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
};

export function ProductsGrid({
  products,
  categories,
  allProductOptions,
  editSku,
  upsertAction,
  toggleStockAction,
  deleteAction,
}: Props) {
  const initialProduct = editSku
    ? products.find((p) => p.sku === editSku) ?? null
    : null;

  const [modalOpen, setModalOpen] = useState(!!editSku);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(initialProduct);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Товары</h2>
          <span className="pill pill-compact">{products.length}</span>
          <button className="button button-primary button-sm" type="button" onClick={openNew}>
            + Добавить
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <div className="admin-product-grid">
          {products.map((product) => {
            const photoCount = product.imageUrls.length || (product.imageUrl ? 1 : 0);
            return (
              <div key={product.id} className="admin-product-card card glass">
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
                    {!product.inStock && (
                      <span className="admin-product-card-badge-off">Отключен</span>
                    )}
                  </div>
                  <div className="admin-product-card-body">
                    <div className="admin-product-card-category muted">{product.category.name}</div>
                    <strong>{product.name}</strong>
                    <div className="admin-product-card-price">
                      {product.price.toLocaleString("ru-RU")} ₽
                    </div>
                  </div>
                </button>
                <div className="admin-product-card-actions">
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
            );
          })}
        </div>
      </section>

      <ProductModal
        open={modalOpen}
        product={modalData}
        categories={categories}
        allProducts={allProductOptions}
        onClose={closeModal}
        upsertAction={upsertAction}
      />
    </>
  );
}
