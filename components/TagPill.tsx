"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export interface CustomerTag {
  id: string;
  name: string;
  color: string; // hex, e.g. "#F59E0B"
}

/**
 * Fixed 10-color palette for tags — no free-form hex input anywhere in the
 * UI. Colors are applied via inline style (soft tint background + full-color
 * text/border) since Tailwind can't generate classes for arbitrary hex values
 * picked at runtime.
 */
export const TAG_COLOR_PALETTE = [
  "#EF4444", // red
  "#F97316", // orange
  "#F59E0B", // amber / gold
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#6366F1", // indigo
  "#A855F7", // purple
  "#EC4899", // pink
  "#6B7280", // gray
];

/** Small colored pill — used on the customer list, the customer detail
 *  page's tag editor, and the tag management page. */
export function TagPill({ tag, onRemove, compact }: { tag: CustomerTag; onRemove?: () => void; compact?: boolean }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      style={{ backgroundColor: `${tag.color}1a`, color: tag.color, border: `1px solid ${tag.color}66` }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("tags.removeTag")}
          className="hover:opacity-60 transition leading-none"
        >
          ✕
        </button>
      )}
    </span>
  );
}
