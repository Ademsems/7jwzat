/**
 * Analytics date-range calculations, shared between the analytics page and
 * (optionally) the API route for validation.
 *
 * Timezone-safety: every date is built from local Date field getters
 * (getFullYear/getMonth/getDate) and formatted as "YYYY-MM-DD" strings —
 * never via toISOString(), which shifts by the UTC offset and can silently
 * land on the wrong calendar day. Range end boundaries are always the true
 * end of the period (not "today"), so bookings already scheduled later in
 * the period are never dropped.
 */

export type RangeKey = "this-week" | "this-month" | "last-30" | "last-90" | "custom";

export interface DateRange {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
}

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse a "YYYY-MM-DD" string as a local-midnight Date (not UTC). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Compute { start, end } for the selected range plus the immediately
 * preceding period of equal length, for "+X% vs previous period" comparisons.
 */
export function computeRange(key: RangeKey, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (key) {
    case "this-week": {
      // Sunday-first week, matching the rest of the dashboard (DOW_JS order).
      const dow = today.getDay();
      const start = addDays(today, -dow);
      const end = addDays(start, 6);
      return {
        start: localDateStr(start),
        end: localDateStr(end),
        prevStart: localDateStr(addDays(start, -7)),
        prevEnd: localDateStr(addDays(end, -7)),
      };
    }
    case "this-month": {
      const y = today.getFullYear(), m = today.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0); // last day of current month, not "today"
      const prevStart = new Date(y, m - 1, 1);
      const prevEnd = new Date(y, m, 0);
      return {
        start: localDateStr(start),
        end: localDateStr(end),
        prevStart: localDateStr(prevStart),
        prevEnd: localDateStr(prevEnd),
      };
    }
    case "last-30": {
      const start = addDays(today, -29);
      const prevEnd = addDays(start, -1);
      const prevStart = addDays(prevEnd, -29);
      return {
        start: localDateStr(start),
        end: localDateStr(today),
        prevStart: localDateStr(prevStart),
        prevEnd: localDateStr(prevEnd),
      };
    }
    case "last-90": {
      const start = addDays(today, -89);
      const prevEnd = addDays(start, -1);
      const prevStart = addDays(prevEnd, -89);
      return {
        start: localDateStr(start),
        end: localDateStr(today),
        prevStart: localDateStr(prevStart),
        prevEnd: localDateStr(prevEnd),
      };
    }
    case "custom": {
      const rawStart = customStart ? parseLocalDate(customStart) : today;
      const rawEnd = customEnd ? parseLocalDate(customEnd) : today;
      const start = rawStart <= rawEnd ? rawStart : rawEnd;
      const end = rawStart <= rawEnd ? rawEnd : rawStart;
      const lenDays = daysBetween(start, end) + 1;
      const prevEnd = addDays(start, -1);
      const prevStart = addDays(prevEnd, -(lenDays - 1));
      return {
        start: localDateStr(start),
        end: localDateStr(end),
        prevStart: localDateStr(prevStart),
        prevEnd: localDateStr(prevEnd),
      };
    }
  }
}

/** Whole-day difference between two "YYYY-MM-DD"-parseable local dates. */
export function daysBetweenLocal(a: Date, b: Date): number {
  return daysBetween(a, b);
}
