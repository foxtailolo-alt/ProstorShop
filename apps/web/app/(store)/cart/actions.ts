"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { getSession } from "../../../lib/auth/session";
import { getAttributionSnapshot } from "../../../lib/attribution";
import { addCartItem, clearCart, getCartItems, removeCartItem, updateCartItem } from "../../../lib/cart";

export async function addToCartAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  const redirectToInput = String(formData.get("redirectTo") ?? "").trim();

  if (!productSlug || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Add to cart request is invalid.");
  }

  await addCartItem(productSlug, quantity);
  revalidatePath("/cart");
  const redirectTo = redirectToInput.startsWith("/") ? redirectToInput : "/cart";
  const separator = redirectTo.includes("?") ? "&" : "?";
  redirect(`${redirectTo}${separator}added=${productSlug}` as "/cart");
}

export async function updateCartItemAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!productSlug || !Number.isInteger(quantity)) {
    throw new Error("Cart update is invalid.");
  }

  await updateCartItem(productSlug, quantity);
  revalidatePath("/cart");
  redirect("/cart");
}

export async function removeCartItemAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "").trim();

  if (!productSlug) {
    throw new Error("Cart remove request is invalid.");
  }

  await removeCartItem(productSlug);
  revalidatePath("/cart");
  redirect("/cart");
}

export async function clearCartAction() {
  await clearCart();
  revalidatePath("/cart");
  redirect("/cart");
}

export async function submitOrderAction(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const fallbackProductSlug = String(formData.get("productSlug") ?? "").trim();
  const fallbackQuantity = Number(formData.get("quantity") ?? 1);

  if (!customerName || !phone) {
    throw new Error("Checkout form is incomplete.");
  }

  const [cartItems, session, attribution] = await Promise.all([
    getCartItems(),
    getSession(),
    getAttributionSnapshot(),
  ]);

  const normalizedItems = cartItems.length > 0
    ? cartItems
    : fallbackProductSlug && Number.isInteger(fallbackQuantity) && fallbackQuantity > 0
      ? [{ productSlug: fallbackProductSlug, quantity: fallbackQuantity }]
      : [];

  if (normalizedItems.length === 0) {
    throw new Error("Cart is empty.");
  }

  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: normalizedItems.map((item) => item.productSlug),
      },
    },
  });

  if (products.length !== normalizedItems.length) {
    throw new Error("One or more cart items were not found.");
  }

  const orderItems = normalizedItems.map((item) => {
    const product = products.find((entry) => entry.slug === item.productSlug);

    if (!product) {
      throw new Error("Product not found.");
    }

    return {
      productId: product.id,
      quantity: item.quantity,
      price: product.price,
      subtotal: Number(product.price) * item.quantity,
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  const order = await prisma.order.create({
    data: {
      userId: session?.user.id ?? null,
      customerName,
      phone,
      note: note || null,
      total,
      attribution: attribution ?? undefined,
      items: {
        create: orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    },
  });

  await clearCart();
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  redirect(`/cart?success=1&orderId=${order.id}`);
}