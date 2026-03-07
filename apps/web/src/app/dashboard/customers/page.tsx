"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, Download, Loader2, ChevronLeft, ChevronRight,
  ArrowUpDown, Mail, Phone, ShoppingBag, PoundSterling,
  Tag, X, Plus,
} from "lucide-react";
import { formatPrice, formatDateTime, cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "last_order_at", label: "Last Order" },
  { value: "total_spent", label: "Total Spent" },
  { value: "total_orders", label: "Order Count" },
  { value: "name", label: "Name" },
  { value: "created_at", label: "Date Added" },
];

const PRESET_TAGS = ["VIP", "Regular", "New", "Allergen Alert", "Difficult", "Local Business"];

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const colors: Record<string, string> = {
    VIP: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Regular: "bg-blue-50 text-blue-700 border-blue-200",
    New: "bg-green-50 text-green-700 border-green-200",
    "Allergen Alert": "bg-red-50 text-red-700 border-red-200",
  };
  const cls = colors[tag] || "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", cls)}>
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70"><X className="h-3 w-3" /></button>
      )}
    </span>
  );
}

function CustomerRow({ customer, onTagUpdate }: {
  customer: any;
  onTagUpdate: (id: string, tags: string[]) => void;
}) {
  const [showTags, setShowTags] = useState(false);
  const tags: string[] = customer.tags || [];

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) onTagUpdate(customer.id, [...tags, tag]);
  };
  const removeTag = (tag: string) => {
    onTagUpdate(customer.id, tags.filter((t: string) => t !== tag));
  };

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div className="h-10 w-10 bg-brand-50 rounded-full flex items-center justify-center shrink-0">
        <span className="text-brand-600 font-bold text-sm">
          {(customer.name || "?").charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{customer.name}</div>
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>
          {customer.phone && (
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>
          )}
        </div>
        {/* Tags */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {tags.map((tag: string) => (
            <TagBadge key={tag} tag={tag} onRemove={() => removeTag(tag)} />
          ))}
          <button
            onClick={() => setShowTags(!showTags)}
            className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-0.5"
          >
            <Plus className="h-3 w-3" /> Tag
          </button>
        </div>
        {showTags && (
          <div className="flex flex-wrap gap-1 mt-2">
            {PRESET_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
              <button
                key={tag}
                onClick={() => { addTag(tag); setShowTags(false); }}
                className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-600 px-2 py-1 rounded-full transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-right shrink-0 space-y-1">
        <div className="flex items-center gap-1 text-sm font-medium justify-end">
          <PoundSterling className="h-3 w-3 text-gray-400" />
          {formatPrice(customer.total_spent)}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
          <ShoppingBag className="h-3 w-3" />
          {customer.total_orders} order{customer.total_orders !== 1 ? "s" : ""}
        </div>
        {customer.last_order_at && (
          <div className="text-xs text-gray-400">
            Last: {new Date(customer.last_order_at).toLocaleDateString("en-GB")}
          </div>
        )}
      </div>

      {/* GDPR Actions */}
      <div className="flex flex-col gap-1 shrink-0">
        <a
          href={`/api/customers/gdpr-export?customer_id=${customer.id}`}
          className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          title="GDPR Data Export"
        >
          <Download className="h-3 w-3" /> Export
        </a>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [data, setData] = useState<{ customers: any[]; total: number; pages: number }>({
    customers: [], total: 0, pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("last_order_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      search, sort, dir, page: page.toString(), limit: "25",
    });
    const res = await fetch(`/api/customers?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [search, sort, dir, page]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleSort = (col: string) => {
    if (sort === col) {
      setDir(dir === "desc" ? "asc" : "desc");
    } else {
      setSort(col);
      setDir("desc");
    }
    setPage(1);
  };

  const exportCsv = () => {
    window.open(`/api/customers?export=csv&search=${search}&sort=${sort}&dir=${dir}`, "_blank");
  };

  const updateTags = async (id: string, tags: string[]) => {
    await fetch("/api/customers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tags }),
    });
    setData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => c.id === id ? { ...c, tags } : c),
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data.total} customer{data.total !== 1 ? "s" : ""} total
          </p>
        </div>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input-field pl-10"
            placeholder="Search by name, email, or phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="input-field w-auto pr-8"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setDir(dir === "desc" ? "asc" : "desc")}
          className="btn-secondary p-2"
          title={dir === "desc" ? "Descending" : "Ascending"}
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
      </div>

      {/* Customer list */}
      <div className="card">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600 mx-auto" />
          </div>
        ) : data.customers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {search ? "No customers match your search." : "No customers yet. They appear as orders come in."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.customers.map((c) => (
              <CustomerRow key={c.id} customer={c} onTagUpdate={updateTags} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t">
            <span className="text-xs text-gray-400">
              Page {page} of {data.pages} · {data.total} customers
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="btn-secondary p-1.5 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(data.pages, page + 1))}
                disabled={page >= data.pages}
                className="btn-secondary p-1.5 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
