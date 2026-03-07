"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Plus, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string;
  address: string;
  role: string;
  is_primary: boolean;
  is_current: boolean;
}

interface Props {
  currentName: string;
  currentSlug: string;
}

export function RestaurantSwitcher({ currentName, currentSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Single location — don't show switcher
  if (locations.length <= 1) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{currentName}</div>
          <div className="text-xs text-gray-400 truncate">/{currentSlug}</div>
        </div>
      </div>
    );
  }

  const switchTo = async (restaurantId: string) => {
    setSwitching(true);
    await fetch("/api/locations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurantId }),
    });
    // Force full page reload to refresh session
    window.location.href = "/dashboard";
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 min-w-0 w-full hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
      >
        <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="text-sm font-semibold text-gray-900 truncate">{currentName}</div>
          <div className="text-xs text-gray-400 truncate">/{currentSlug}</div>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {switching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              <span className="text-xs text-gray-500 ml-2">Switching...</span>
            </div>
          ) : (
            <>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => { if (!loc.is_current) switchTo(loc.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors",
                    loc.is_current && "bg-brand-50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{loc.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{loc.address || `/${loc.slug}`}</div>
                  </div>
                  {loc.is_current && <Check className="h-3.5 w-3.5 text-brand-600 shrink-0" />}
                  {!loc.is_active && <span className="text-[9px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">Draft</span>}
                </button>
              ))}
              <div className="border-t mt-1 pt-1">
                <button
                  onClick={() => { setOpen(false); router.push("/dashboard/franchise?add=true"); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Location
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
