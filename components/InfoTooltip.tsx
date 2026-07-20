"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Module-level: close the currently open tooltip when another one opens.
let closeActive: (() => void) | null = null;

interface InfoTooltipProps {
  /** i18n key — resolved via t() */
  textKey?: string;
  /** Literal text — used instead of textKey when provided */
  text?: string;
  className?: string;
}

export function InfoTooltip({ textKey, text, className = "" }: InfoTooltipProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const content = text ?? (textKey ? t(textKey) : "");

  function toggle() {
    if (!open) {
      // Close whatever tooltip is currently showing
      if (closeActive) closeActive();
      closeActive = () => setOpen(false);
      setOpen(true);
    } else {
      if (closeActive === (() => setOpen(false))) closeActive = null;
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    // Position: open below the button, shift left if near right edge
    const btn = btnRef.current?.getBoundingClientRect();
    if (btn) {
      const vw = window.innerWidth;
      const popW = 240;
      const rightSpace = vw - btn.left;
      if (rightSpace < popW + 8) {
        // Near right edge — align the popover's right side to the button's right
        setStyle({ right: 0, left: "auto" });
      } else {
        setStyle({ left: 0, right: "auto" });
      }
    }

    function onDown(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !popRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        closeActive = null;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        closeActive = null;
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (closeActive === (() => setOpen(false))) closeActive = null;
    };
  }, []);

  if (!content) return null;

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label="More information"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition text-[11px] leading-none select-none"
      >
        ⓘ
      </button>

      {open && (
        <div
          ref={popRef}
          role="tooltip"
          style={style}
          className="absolute top-full mt-1.5 z-50 w-60 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs text-gray-600 leading-relaxed"
        >
          {/* Small arrow */}
          <span
            className="absolute -top-1.5 start-3 w-3 h-3 bg-white border-s border-t border-gray-200 rotate-45 rounded-tl"
            aria-hidden="true"
          />
          {content}
        </div>
      )}
    </span>
  );
}
