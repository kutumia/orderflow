"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { HelpCircle, X, Search, ChevronRight, ExternalLink, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import articles from "@/../../content/help/articles.json";

// Map dashboard paths to article tags
const PATH_TAG_MAP: Record<string, string[]> = {
  "/dashboard": ["onboarding", "dashboard"],
  "/dashboard/menu": ["menu"],
  "/dashboard/orders": ["orders"],
  "/dashboard/hours": ["hours"],
  "/dashboard/printer": ["printer"],
  "/dashboard/billing": ["billing"],
  "/dashboard/customers": ["customers"],
  "/dashboard/loyalty": ["loyalty"],
  "/dashboard/marketing": ["marketing"],
  "/dashboard/qr-code": ["qr-code"],
  "/dashboard/reports": ["reports"],
  "/dashboard/promotions": ["promotions"],
  "/dashboard/staff": ["staff"],
  "/dashboard/settings": ["settings"],
  "/dashboard/onboarding": ["onboarding"],
};

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = usePathname();

  // Find relevant tags for current page
  const currentTags = Object.entries(PATH_TAG_MAP).find(([path]) => pathname.startsWith(path))?.[1] || [];

  // Get contextual articles (matching current page)
  const contextual = articles.filter((a) => a.tags.some((t) => currentTags.includes(t)));

  // Get search results
  const searchResults = search
    ? articles.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const displayArticles = search ? searchResults : contextual;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        title="Help"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />

          {/* Panel */}
          <div className="relative w-full max-w-sm bg-white shadow-xl flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h2 className="font-semibold">Help</h2>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search help articles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  autoFocus
                />
              </div>
            </div>

            {/* Articles */}
            <div className="flex-1 overflow-y-auto p-3">
              {!search && contextual.length > 0 && (
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 px-1">
                  Related to this page
                </p>
              )}
              {search && searchResults.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No articles found.</p>
              )}
              <div className="space-y-1">
                {displayArticles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/help/${article.slug}`}
                    target="_blank"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-brand-700">{article.title}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {article.content.substring(0, 80)}...
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-brand-500 shrink-0" />
                  </Link>
                ))}
              </div>

              {/* All articles link */}
              {!search && (
                <Link
                  href="/help"
                  target="_blank"
                  className="flex items-center gap-2 p-2.5 mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View all help articles
                </Link>
              )}
            </div>

            {/* Contact */}
            <div className="p-3 border-t bg-gray-50 shrink-0">
              <a
                href="mailto:support@orderflow.co.uk"
                className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-white transition-colors text-sm text-gray-600"
              >
                <Mail className="h-4 w-4 text-gray-400" />
                <span>Contact Support</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
