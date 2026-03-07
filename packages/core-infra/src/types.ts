/**
 * Shared domain types for OrderFlow (restaurants, orders, print jobs, tenants).
 * Use these across packages and apps for consistent typing.
 */

export interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  stripe_account_id?: string;
  [key: string]: unknown;
}

export interface Order {
  id: string;
  restaurant_id: string;
  status: string;
  total?: number;
  [key: string]: unknown;
}

export interface PrintJob {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  device_id?: string;
  order_id?: string;
  receipt_data: string;
  status: 'queued' | 'printing' | 'printed' | 'failed';
  priority: number;
  attempts: number;
  error_message?: string;
  created_at: string;
  printed_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  webhook_url?: string;
  monthly_limit: number;
  usage_count: number;
  is_internal: boolean;
  plan: string;
  restaurant_id?: string;
}
