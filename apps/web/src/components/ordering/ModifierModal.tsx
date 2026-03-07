"use client";

import { useState } from "react";
import { X, Minus, Plus } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { getAllergenEmoji } from "@/lib/allergens";
import { useCart, CartItem } from "./CartContext";

interface ModifierOption {
  name: string;
  price: number;
}

interface Modifier {
  id: string;
  name: string;
  options: ModifierOption[];
  required: boolean;
  max_choices: number;
}

interface ItemForModal {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  allergens: string[];
  calories: number | null;
  item_modifiers: Modifier[];
}

export function ModifierModal({
  item,
  onClose,
}: {
  item: ItemForModal;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<
    Record<string, ModifierOption[]>
  >({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const toggleModifier = (modId: string, option: ModifierOption, maxChoices: number) => {
    setSelectedModifiers((prev) => {
      const current = prev[modId] || [];
      const exists = current.find((o) => o.name === option.name);

      if (exists) {
        return { ...prev, [modId]: current.filter((o) => o.name !== option.name) };
      }

      if (maxChoices === 1) {
        return { ...prev, [modId]: [option] };
      }

      if (current.length >= maxChoices) return prev;
      return { ...prev, [modId]: [...current, option] };
    });
  };

  const isSelected = (modId: string, optionName: string) => {
    return (selectedModifiers[modId] || []).some((o) => o.name === optionName);
  };

  // Calculate total price
  const modifierTotal = Object.values(selectedModifiers)
    .flat()
    .reduce((sum, opt) => sum + opt.price, 0);
  const totalPrice = (item.price + modifierTotal) * quantity;

  const handleAdd = () => {
    // Validate required modifiers
    for (const mod of item.item_modifiers) {
      if (mod.required && !(selectedModifiers[mod.id]?.length > 0)) {
        setError(`Please select a ${mod.name}`);
        return;
      }
    }

    const cartItem: CartItem = {
      item_id: item.id,
      name: item.name,
      price: item.price + modifierTotal,
      quantity,
      modifiers: Object.entries(selectedModifiers).flatMap(([modId, opts]) => {
        const mod = item.item_modifiers.find((m) => m.id === modId);
        return opts.map((opt) => ({
          name: mod?.name || "",
          option: opt.name,
          price: opt.price,
        }));
      }),
      notes: notes.trim() || null,
    };

    addItem(cartItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto">
        {/* Image */}
        {item.image_url && (
          <div className="relative h-48 bg-gray-100">
            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 shadow"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-lg font-semibold pr-4">{item.name}</h3>
            {!item.image_url && (
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded shrink-0">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-gray-500 mb-2">{item.description}</p>
          )}
          <div className="flex items-center gap-3 mb-4">
            <span className="font-semibold">{formatPrice(item.price)}</span>
            {item.calories && (
              <span className="text-xs text-gray-400">{item.calories} cal</span>
            )}
          </div>

          {/* Allergens */}
          {item.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {item.allergens.map((a) => (
                <span
                  key={a}
                  className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-full"
                >
                  {getAllergenEmoji(a)} {a}
                </span>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-danger-50 text-danger-500 text-sm px-3 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Modifiers */}
          {item.item_modifiers.map((mod) => (
            <div key={mod.id} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{mod.name}</span>
                {mod.required && (
                  <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                    Required
                  </span>
                )}
                {mod.max_choices > 1 && (
                  <span className="text-xs text-gray-400">
                    Choose up to {mod.max_choices}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {mod.options.map((opt) => (
                  <button
                    key={opt.name}
                    onClick={() => toggleModifier(mod.id, opt, mod.max_choices)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left",
                      isSelected(mod.id, opt.name)
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <span>{opt.name}</span>
                    {opt.price > 0 && (
                      <span className="text-gray-500">+{formatPrice(opt.price)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Special instructions (optional)
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="No onions, extra spicy, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Quantity + Add */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-gray-100 rounded-lg px-3 py-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium w-6 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button onClick={handleAdd} className="btn-primary flex-1 text-center">
              Add to basket &middot; {formatPrice(totalPrice)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
