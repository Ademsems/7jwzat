// Locale-aware date/time formatting. Usable from client and server (emails).
export type Locale = "ar" | "en";

/** Format a "YYYY-MM-DD" date string with Levantine month names under ar-JO. */
export function formatDateLocale(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(locale === "ar" ? "ar-JO" : "en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    numberingSystem: "latn", // keep Western digits
  });
}

/** Format an "HH:MM" (or "HH:MM:SS") time. ar → "10:00 صباحاً/مساءً". */
export function formatTimeLocale(timeStr: string, locale: Locale): string {
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  if (isNaN(h)) return timeStr;
  const h12 = h % 12 || 12;
  const mm = String(isNaN(m) ? 0 : m).padStart(2, "0");
  if (locale === "ar") {
    const period = h >= 12 ? "مساءً" : "صباحاً";
    return `${String(h12).padStart(2, "0")}:${mm} ${period}`;
  }
  const period = h >= 12 ? "PM" : "AM";
  return `${String(h12).padStart(2, "0")}:${mm} ${period}`;
}
