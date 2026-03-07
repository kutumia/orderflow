"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  item_id: string;
  name: string;
  price: number; // pence (base price + modifier prices)
  quantity: number;
  modifiers: { name: string; option: string; price: number }[];
  notes: string | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, qty: number) => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({
  children,
  slug,
}: {
  children: ReactNode;
  slug: string;
}) {
  const storageKey = `orderflow_cart_${slug}`;

  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      // Check if same item with same modifiers already exists
      const existingIndex = prev.findIndex(
        (i) =>
          i.item_id === item.item_id &&
          JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
        };
        return updated;
      }
      return [...prev, item];
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    if (qty <= 0) {
      removeItem(index);
      return;
    }
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: qty };
      return updated;
    });
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, subtotal, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
