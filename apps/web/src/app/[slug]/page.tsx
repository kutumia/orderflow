"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  MapPin,
  Phone,
  Clock,
  ShoppingBag,
  Star,
  Minus,
  Plus,
  X,
  Trash2,
  Loader2,
  ChevronRight,
  AlertTriangle,
  ImageIcon,
} from "lucide-react";
import { formatPrice, cn, getDayName } from "@/lib/utils";
import { getAllergenEmoji } from "@/lib/allergens";
import { CartProvider, useCart } from "@/components/ordering/CartContext";
import { ModifierModal } from "@/components/ordering/ModifierModal";

// ── TYPES ──
interface RestaurantData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  delivery_enabled: boolean;
  collection_enabled: boolean;
  delivery_fee: number;
  min_order_delivery: number;
  min_order_collection: number;
  estimated_delivery_mins: number;
  estimated_collection_mins: number;
  holiday_mode: boolean;
  holiday_message: string | null;
}

interface CategoryWithItems {
  id: string;
  name: string;
  sort_order: number;
  items: any[];
}

// ── MENU ITEM CARD ──
function MenuItemCard({ item, onSelect }: { item: any; onSelect: () => void }) {
  if (!item.is_available) return null;

  return (
    <button
      onClick={onSelect}
      className="flex gap-4 p-4 hover:bg-gray-50 transition-colors w-full text-left rounded-lg"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm">{item.name}</span>
          {item.is_popular && (
            <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              Popular
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-1">
            {item.description}
          </p>
        )}
        {item.allergens?.length > 0 && (
          <div className="flex gap-1 mb-1">
            {item.allergens.map((a: string) => (
              <span key={a} className="text-xs" title={a}>
                {getAllergenEmoji(a)}
              </span>
            ))}
          </div>
        )}
        <span className="text-sm font-semibold text-brand-700">
          {formatPrice(item.price)}
        </span>
        {item.calories && (
          <span className="text-xs text-gray-400 ml-2">{item.calories} cal</span>
        )}
      </div>
      {item.image_url && (
        <img
          src={item.image_url}
          alt=""
          className="h-20 w-20 rounded-lg object-cover shrink-0"
        />
      )}
    </button>
  );
}

// ── BASKET PANEL ──
function BasketPanel({
  restaurant,
  open,
  onClose,
}: {
  restaurant: RestaurantData;
  open: boolean;
  onClose: () => void;
}) {
  const { items, removeItem, updateQuantity, subtotal, clearCart } = useCart();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Your Basket</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Your basket is empty</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1.5 shrink-0">
                    <button
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      className="p-0.5"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-medium w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                      className="p-0.5"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{item.name}</div>
                    {item.modifiers.length > 0 && (
                      <div className="text-xs text-gray-400">
                        {item.modifiers.map((m) => m.option).join(", ")}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-xs text-gray-400 italic">
                        {item.notes}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-sm font-medium shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(index)}
                    className="p-1 hover:bg-gray-100 rounded shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal)}</span>
              </div>
              {restaurant.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Delivery fee</span>
                  <span>{formatPrice(restaurant.delivery_fee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatPrice(subtotal + restaurant.delivery_fee)}</span>
              </div>
              <a
                href={`/${restaurant.slug}/checkout`}
                className="btn-primary w-full text-center block"
              >
                Proceed to Checkout
              </a>
              <button
                onClick={clearCart}
                className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
              >
                Clear basket
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN ORDERING PAGE ──
function RecentOrdersSection({ slug, menu }: { slug: string; menu: any[] }) {
  const [recentOrder, setRecentOrder] = useState<any>(null);
  const { addItem } = useCart();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`orderflow_recent_${slug}`);
      if (stored) {
        const orders = JSON.parse(stored);
        if (orders.length > 0) setRecentOrder(orders[0]);
      }
    } catch { /* */ }
  }, [slug]);

  if (!recentOrder) return null;

  // Check which items are still available
  const allItems = menu.flatMap((c) => c.items || []);
  const available = (recentOrder.items || []).filter((ri: any) =>
    allItems.some((mi: any) => mi.name === ri.name && mi.is_available)
  );

  if (available.length === 0) return null;

  const reorder = () => {
    for (const item of available) {
      const menuItem = allItems.find((mi: any) => mi.name === item.name);
      if (menuItem) {
        addItem({ ...menuItem, quantity: item.quantity, modifiers: item.modifiers || [] });
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900">Order Again</span>
        <button onClick={reorder}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 px-3 py-1.5 bg-brand-50 rounded-lg">
          Add all to basket
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        {available.length} item{available.length !== 1 ? "s" : ""} from your last order
      </p>
      <div className="flex flex-wrap gap-2">
        {available.slice(0, 5).map((item: any, i: number) => (
          <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
            {item.quantity}x {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function OrderingPageContent() {
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<{
    restaurant: RestaurantData;
    menu: CategoryWithItems[];
    hours: any[];
    isOpen: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const { itemCount, subtotal } = useCart();

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/restaurants?slug=${slug}`);
        if (!res.ok) {
          setError("Restaurant not found");
          setLoading(false);
          return;
        }
        const result = await res.json();
        setData(result);
        if (result.menu.length > 0) setActiveCategory(result.menu[0].id);
      } catch {
        setError("Failed to load restaurant");
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    categoryRefs.current[catId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Restaurant not found
          </h1>
          <p className="text-gray-500">
            This restaurant doesn&apos;t exist or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  const { restaurant, menu, hours, isOpen } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {restaurant.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">
              {restaurant.name}
            </h1>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {isOpen ? (
                <span className="text-success-500 font-medium">Open now</span>
              ) : (
                <span className="text-danger-500 font-medium">Closed</span>
              )}
              {restaurant.estimated_collection_mins > 0 && (
                <span>{restaurant.estimated_collection_mins} min collection</span>
              )}
            </div>
          </div>
          {/* Basket button */}
          <button
            onClick={() => setBasketOpen(true)}
            className="relative p-2 hover:bg-gray-100 rounded-lg"
          >
            <ShoppingBag className="h-5 w-5 text-gray-700" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Banner image */}
      {restaurant.banner_url && (
        <div className="max-w-3xl mx-auto">
          <img
            src={restaurant.banner_url}
            alt=""
            className="w-full h-40 sm:h-52 object-cover"
          />
        </div>
      )}

      {/* Holiday mode */}
      {restaurant.holiday_mode && (
        <div className="bg-warning-50 text-warning-500 text-sm text-center py-3 px-4 flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {restaurant.holiday_message || "We are currently closed. Please check back later."}
        </div>
      )}

      {/* Restaurant info */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {restaurant.description && (
            <p className="text-sm text-gray-600 mb-3">{restaurant.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {restaurant.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {restaurant.address}
              </span>
            )}
            {restaurant.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {restaurant.phone}
              </span>
            )}
            {restaurant.delivery_enabled && (
              <span className="flex items-center gap-1">
                Delivery: {formatPrice(restaurant.delivery_fee)} · Min{" "}
                {formatPrice(restaurant.min_order_delivery)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs (scrollable) */}
      {menu.length > 0 && (
        <div className="bg-white border-b sticky top-[57px] z-20">
          <div className="max-w-3xl mx-auto overflow-x-auto">
            <div className="flex px-4 gap-1 py-2">
              {menu
                .filter((cat) => cat.items.length > 0)
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors",
                      activeCategory === cat.id
                        ? "bg-brand-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        {menu.length === 0 ? (
          <div className="text-center py-16">
            <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              This restaurant hasn&apos;t added their menu yet.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Order Again — recent orders from localStorage */}
            <RecentOrdersSection slug={slug} menu={menu} />
            {menu
              .filter((cat) => cat.items.length > 0)
              .map((cat) => (
                <div
                  key={cat.id}
                  ref={(el) => { categoryRefs.current[cat.id] = el; }}
                >
                  <h2 className="text-lg font-bold text-gray-900 mb-3 sticky top-[105px] bg-gray-50 py-2 z-10">
                    {cat.name}
                  </h2>
                  <div className="bg-white rounded-xl border divide-y divide-gray-100">
                    {cat.items
                      .filter((item: any) => item.is_available)
                      .map((item: any) => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          onSelect={() => setSelectedItem(item)}
                        />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Fixed bottom basket bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-white border-t shadow-lg">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setBasketOpen(true)}
              className="btn-primary w-full flex items-center justify-between px-6 py-3"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                View Basket ({itemCount})
              </span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modifier modal */}
      {selectedItem && (
        <ModifierModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Basket panel */}
      <BasketPanel
        restaurant={restaurant}
        open={basketOpen}
        onClose={() => setBasketOpen(false)}
      />
    </div>
  );
}

// ── WRAPPER WITH CART PROVIDER ──
export default function OrderingPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <CartProvider slug={slug}>
      <OrderingPageContent />
    </CartProvider>
  );
}
