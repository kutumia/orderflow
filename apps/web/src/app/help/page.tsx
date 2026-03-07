"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, BookOpen, ChevronRight } from "lucide-react";
import articles from "@/../../content/help/articles.json";

const TAG_LABELS: Record<string, string> = {
  onboarding: "Getting Started",
  dashboard: "Dashboard",
  menu: "Menu",
  orders: "Orders",
  reports: "Reports",
  printer: "Printing",
  settings: "Settings",
  billing: "Billing",
  loyalty: "Loyalty",
  marketing: "Marketing",
  "qr-code": "QR Codes",
  ordering: "Ordering",
  mobile: "Mobile",
  hours: "Hours",
  delivery: "Delivery",
  promotions: "Promotions",
  staff: "Staff",
  customers: "Customers",
};

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = [...new Set(articles.flatMap((a) => a.tags))];

  const filtered = articles.filter((a) => {
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !activeTag || a.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Dashboard →</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <BookOpen className="h-10 w-10 text-brand-600 mx-auto mb-3" />
          <h1 className="text-3xl font-bold">Help Centre</h1>
          <p className="text-gray-500 mt-2">Find answers to common questions about OrderFlow.</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !activeTag ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeTag === tag ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {TAG_LABELS[tag] || tag}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((article) => (
            <Link
              key={article.slug}
              href={`/help/${article.slug}`}
              className="flex items-center gap-3 bg-white rounded-xl border p-4 hover:border-brand-200 hover:bg-brand-50/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm group-hover:text-brand-700 transition-colors">{article.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{article.content.substring(0, 120)}...</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-brand-500 shrink-0" />
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No articles found. Try a different search term.</p>
            </div>
          )}
        </div>

        <div className="text-center mt-12 p-6 bg-white rounded-xl border">
          <p className="text-sm text-gray-600 mb-2">Can't find what you need?</p>
          <a href="mailto:support@orderflow.co.uk" className="text-sm text-brand-600 font-medium hover:text-brand-700">
            Contact Support →
          </a>
        </div>
      </main>
    </div>
  );
}
