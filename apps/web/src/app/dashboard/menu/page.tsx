"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Loader2,
  ImageIcon,
  X,
  Star,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { ALLERGENS } from "@/lib/allergens";

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_popular: boolean;
  allergens: string[];
  calories: number | null;
  item_modifiers: any[];
}

// ── ALLERGEN PICKER ──
function AllergenPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (allergens: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((a) => a !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ALLERGENS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => toggle(a.id)}
          className={cn(
            "text-xs px-2.5 py-1.5 rounded-full border transition-colors",
            selected.includes(a.id)
              ? "bg-warning-50 border-warning-500 text-warning-500"
              : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
          )}
        >
          {a.emoji} {a.label}
        </button>
      ))}
    </div>
  );
}

// ── ITEM EDITOR MODAL ──
function ItemModal({
  item,
  categoryId,
  onSave,
  onClose,
}: {
  item: MenuItem | null;
  categoryId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: item?.name || "",
    description: item?.description || "",
    price: item ? (item.price / 100).toFixed(2) : "",
    image_url: item?.image_url || "",
    is_available: item?.is_available ?? true,
    is_popular: item?.is_popular ?? false,
    allergens: item?.allergens || ([] as string[]),
    calories: item?.calories?.toString() || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setForm((prev) => ({ ...prev, image_url: data.url }));
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("Item name is required"); return; }
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      setError("Valid price is required"); return;
    }

    setSaving(true);
    const body = {
      ...(item ? { id: item.id } : {}),
      category_id: categoryId,
      name: form.name,
      description: form.description || null,
      price: Math.round(parseFloat(form.price) * 100),
      image_url: form.image_url || null,
      is_available: form.is_available,
      is_popular: form.is_popular,
      allergens: form.allergens,
      calories: form.calories ? parseInt(form.calories) : null,
    };

    try {
      const res = await fetch("/api/menu-items", {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSave();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Save failed");
      }
    } catch {
      setError("Save failed");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold">
            {item ? "Edit Item" : "Add New Item"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-danger-50 text-danger-500 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="label">Item Name *</label>
            <input
              className="input-field"
              placeholder="Chicken Tikka Masala"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Tender chicken in a rich, creamy tomato sauce..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (£) *</label>
              <input
                className="input-field"
                type="number"
                step="0.01"
                min="0"
                placeholder="12.95"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Calories (optional)</label>
              <input
                className="input-field"
                type="number"
                min="0"
                placeholder="550"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: e.target.value })}
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="label">Photo</label>
            {form.image_url ? (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, image_url: "" })}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-400 transition-colors">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm text-gray-500">
                  {uploading ? "Uploading..." : "Click to upload image (max 5MB)"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Allergens */}
          <div>
            <label className="label">Allergens (Natasha&apos;s Law)</label>
            <p className="text-xs text-gray-400 mb-2">
              Select all allergens present in this dish
            </p>
            <AllergenPicker
              selected={form.allergens}
              onChange={(allergens) => setForm({ ...form, allergens })}
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_available}
                onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm text-gray-700">Available</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_popular}
                onChange={(e) => setForm({ ...form, is_popular: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm text-gray-700">Mark as Popular</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {item ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CATEGORY SECTION ──
function CategorySection({
  category,
  items,
  onEdit,
  onDelete,
  onRefresh,
}: {
  category: Category;
  items: MenuItem[];
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const toggleAvailability = async (item: MenuItem) => {
    await fetch("/api/menu-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, toggle_availability: !item.is_available }),
    });
    onRefresh();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/menu-items?id=${id}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div className="card">
      {/* Category header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
        <button onClick={() => setExpanded(!expanded)} className="p-0.5">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </button>
        <h3 className="font-semibold text-gray-900 flex-1">{category.name}</h3>
        <span className="text-xs text-gray-400">{items.length} items</span>
        <button onClick={() => onEdit(category)} className="p-1.5 hover:bg-gray-100 rounded">
          <Pencil className="h-3.5 w-3.5 text-gray-400" />
        </button>
        <button onClick={() => onDelete(category.id)} className="p-1.5 hover:bg-gray-100 rounded">
          <Trash2 className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {/* Items list */}
      {expanded && (
        <div>
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No items in this category yet
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors",
                    !item.is_available && "opacity-50"
                  )}
                >
                  {/* Image thumbnail */}
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <ImageIcon className="h-5 w-5 text-gray-300" />
                    </div>
                  )}

                  {/* Item details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{item.name}</span>
                      {item.is_popular && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-400 truncate">{item.description}</p>
                    )}
                    {item.allergens.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.allergens.slice(0, 5).map((a) => (
                          <span key={a} className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                            {a}
                          </span>
                        ))}
                        {item.allergens.length > 5 && (
                          <span className="text-xs text-gray-400">+{item.allergens.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <span className="text-sm font-semibold text-gray-900 shrink-0">
                    {formatPrice(item.price)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleAvailability(item)}
                      className="p-1.5 hover:bg-gray-100 rounded"
                      title={item.is_available ? "Mark unavailable" : "Mark available"}
                    >
                      {item.is_available ? (
                        <Eye className="h-3.5 w-3.5 text-success-500" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => { setEditingItem(item); setShowItemModal(true); }}
                      className="p-1.5 hover:bg-gray-100 rounded"
                    >
                      <Pencil className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 hover:bg-gray-100 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add item button */}
          <div className="p-3 border-t border-gray-100">
            <button
              onClick={() => { setEditingItem(null); setShowItemModal(true); }}
              className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 px-3 py-2 hover:bg-brand-50 rounded-lg w-full"
            >
              <Plus className="h-4 w-4" />
              Add item to {category.name}
            </button>
          </div>
        </div>
      )}

      {/* Item modal */}
      {showItemModal && (
        <ItemModal
          item={editingItem}
          categoryId={category.id}
          onSave={onRefresh}
          onClose={() => { setShowItemModal(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

// ── MAIN MENU PAGE ──
export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");

  const fetchData = useCallback(async () => {
    const [catRes, itemRes] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/menu-items"),
    ]);
    if (catRes.ok) setCategories(await catRes.json());
    if (itemRes.ok) setItems(await itemRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName }),
    });
    if (res.ok) {
      setNewCatName("");
      fetchData();
    }
    setAddingCat(false);
  };

  const updateCategory = async () => {
    if (!editingCat || !editCatName.trim()) return;
    await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingCat.id, name: editCatName }),
    });
    setEditingCat(null);
    fetchData();
  };

  const reorderCategories = async (fromIndex: number, toIndex: number) => {
    const sorted = [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    const updated = sorted.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(updated);
    // Persist
    await fetch("/api/sort-order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "categories",
        items: updated.map((c) => ({ id: c.id, sort_order: c.sort_order })),
      }),
    });
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Items inside must be deleted first.")) return;
    const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Delete failed");
      return;
    }
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Menu</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your categories and dishes. Changes go live instantly.
          </p>
        </div>
      </div>

      {/* Add category */}
      <div className="card p-4 mb-6">
        <div className="flex gap-3">
          <input
            className="input-field flex-1"
            placeholder="New category name (e.g. Starters, Mains, Desserts)"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button
            onClick={addCategory}
            disabled={addingCat || !newCatName.trim()}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
            {addingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Category
          </button>
        </div>
      </div>

      {/* Categories and items */}
      {categories.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 mb-2">No categories yet.</p>
          <p className="text-sm text-gray-400">
            Create your first category above (e.g. &quot;Starters&quot;), then add dishes to it.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((cat, index) => (
            <div key={cat.id} className="group">
              {/* Drag handle + category */}
              <div className="flex items-start gap-1">
                <div className="flex flex-col gap-1 mt-2">
                  <button
                    className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => reorderCategories(index, index - 1)}
                    title="Move up"
                  >
                    <ChevronRight className="h-4 w-4 -rotate-90" />
                  </button>
                  <button
                    className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                    disabled={index === categories.length - 1}
                    onClick={() => reorderCategories(index, index + 1)}
                    title="Move down"
                  >
                    <ChevronRight className="h-4 w-4 rotate-90" />
                  </button>
                </div>
                <div className="flex-1">
                  <CategorySection
                    key={cat.id}
                    category={cat}
                    items={items.filter((i) => i.category_id === cat.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))}
                    onEdit={(c) => { setEditingCat(c); setEditCatName(c.name); }}
                    onDelete={deleteCategory}
                    onRefresh={fetchData}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit category modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-semibold mb-4">Edit Category</h3>
            <input
              className="input-field mb-4"
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && updateCategory()}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setEditingCat(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={updateCategory} className="btn-primary flex-1">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
