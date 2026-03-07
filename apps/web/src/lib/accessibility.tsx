"use client";

/**
 * Accessibility utilities for OrderFlow.
 * WCAG 2.1 AA compliance helpers.
 */

import { useEffect } from "react";

/**
 * SkipLink — allows keyboard users to skip to main content.
 * Place at the very top of the page layout.
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:text-brand-600 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-medium"
    >
      Skip to main content
    </a>
  );
}

/**
 * useFocusTrap — traps focus within a container (for modals/dialogs).
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const container = ref.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if (e.key === "Escape") {
        container.closest("[data-dialog]")?.dispatchEvent(new Event("close"));
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    first.focus();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [ref, isActive]);
}

/**
 * LiveRegion — announces changes to screen readers.
 */
export function LiveRegion({ message, type = "polite" }: { message: string; type?: "polite" | "assertive" }) {
  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
