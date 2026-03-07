"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { RestaurantSwitcher } from "./RestaurantSwitcher";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Monitor,
  BarChart3,
  Users,
  Tag,
  Settings,
  Printer,
  Clock,
  CreditCard,
  LogOut,
  Utensils,
  ChevronLeft,
  Menu,
  Gift,
  Mail,
  QrCode,
  Share2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  ownerOnly?: boolean;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed },
  { label: "Kitchen", href: "/dashboard/kitchen", icon: Monitor },
];

const manageNav: NavItem[] = [
  { label: "Customers", href: "/dashboard/customers", icon: Users, ownerOnly: true },
  { label: "Loyalty", href: "/dashboard/loyalty", icon: Gift, ownerOnly: true },
  { label: "Promotions", href: "/dashboard/promotions", icon: Tag, ownerOnly: true },
  { label: "Marketing", href: "/dashboard/marketing", icon: Mail, ownerOnly: true },
  { label: "QR Code", href: "/dashboard/qr-code", icon: QrCode, ownerOnly: true },
  { label: "Referrals", href: "/dashboard/referrals", icon: Share2, ownerOnly: true },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, ownerOnly: true },
  { label: "Franchise", href: "/dashboard/franchise", icon: Building2, ownerOnly: true },
];

const settingsNav: NavItem[] = [
  { label: "Opening Hours", href: "/dashboard/hours", icon: Clock },
  { label: "Printer", href: "/dashboard/printer", icon: Printer },
  { label: "Staff", href: "/dashboard/staff", icon: Users, ownerOnly: true },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard, ownerOnly: true },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, ownerOnly: true },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-brand-50 text-brand-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
      {!collapsed && <span>{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function NavSection({
  title,
  items,
  collapsed,
  userRole,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  userRole: string;
}) {
  const filtered = items.filter((item) => !item.ownerOnly || userRole === "owner");
  if (filtered.length === 0) return null;

  return (
    <div>
      {!collapsed && title && (
        <div className="px-3 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className="space-y-0.5">
        {filtered.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

interface SidebarProps {
  restaurantName: string;
  restaurantSlug: string;
  userRole?: string;
}

export function Sidebar({ restaurantName, restaurantSlug, userRole = "owner" }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 bg-white p-2 rounded-lg shadow-md border border-gray-200"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 flex flex-col transition-all duration-200",
          collapsed ? "w-[68px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          {!collapsed && (
            <RestaurantSwitcher currentName={restaurantName} currentSlug={restaurantSlug} />
          )}
          {collapsed && (
            <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center mx-auto">
              <Utensils className="h-4 w-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 shrink-0"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          <NavSection title="" items={mainNav} collapsed={collapsed} userRole={userRole} />
          <NavSection title="Manage" items={manageNav} collapsed={collapsed} userRole={userRole} />
          <NavSection title="Settings" items={settingsNav} collapsed={collapsed} userRole={userRole} />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100">
          {!collapsed && (
            <a
              href={`/${restaurantSlug}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-lg mb-1"
            >
              <Utensils className="h-4 w-4" />
              View Live Site
            </a>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 w-full",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
