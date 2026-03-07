// ──────────────────────────────────────
// Core data types for OrderFlow
// ──────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url: string | null;
  banner_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  is_active: boolean;
  subscription_status: "trialing" | "active" | "past_due" | "cancelled";
  stripe_account_id: string | null;
  stripe_customer_id: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  holiday_mode: boolean;
  holiday_message: string | null;
  delivery_enabled: boolean;
  collection_enabled: boolean;
  delivery_fee: number;
  min_order_delivery: number;
  min_order_collection: number;
  estimated_delivery_mins: number;
  estimated_collection_mins: number;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  restaurant_id: string;
  role: "owner" | "staff" | "admin";
  created_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_popular: boolean;
  sort_order: number;
  allergens: string[];
  calories: number | null;
  vat_rate: number;
}

export interface ItemModifier {
  id: string;
  item_id: string;
  name: string;
  options: ModifierOption[];
  required: boolean;
  max_choices: number;
}

export interface ModifierOption {
  name: string;
  price: number;
}

export interface Order {
  id: string;
  restaurant_id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  vat_amount: number;
  total: number;
  status: OrderStatus;
  order_type: "delivery" | "collection";
  delivery_address: string | null;
  notes: string | null;
  stripe_payment_intent_id: string | null;
  allergen_confirmed: boolean;
  promo_code_used: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  created_at: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "collected"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  item_id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: { name: string; option: string; price: number }[];
  notes: string | null;
}

export interface PromoCode {
  id: string;
  restaurant_id: string;
  code: string;
  type: "percentage" | "fixed" | "free_delivery";
  value: number;
  min_order: number;
  expiry: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
}

export interface Customer {
  id: string;
  restaurant_id: string;
  email: string;
  name: string;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  loyalty_points: number;
  tags: string[];
  gdpr_consent_at: string | null;
}

export interface OpeningHours {
  id: string;
  restaurant_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface PrintJob {
  id: string;
  restaurant_id: string;
  order_id: string;
  status: "queued" | "sent" | "failed" | "retried";
  error_message: string | null;
  fallback_sent: boolean;
  created_at: string;
  sent_at: string | null;
  retry_count: number;
}

export interface Subscription {
  id: string;
  restaurant_id: string;
  stripe_subscription_id: string | null;
  plan: "starter" | "growth" | "pro";
  status: "trialing" | "active" | "past_due" | "cancelled";
  trial_ends_at: string;
  current_period_end: string | null;
}

// Auth session extension
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  restaurant_id: string;
  restaurant_slug: string;
  restaurant_name: string;
  role: "owner" | "staff" | "admin";
}

// Order status tracking
export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string | null;
  created_at: string;
}
