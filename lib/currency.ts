/**
 * Country → currency mapping and price formatting.
 *
 * Each business stores its own `country` and `currency` (set at signup from
 * the country, then independently editable). All money shown to customers and
 * owners must be formatted with the business's currency via formatPrice().
 */

export interface CountryOption {
  code: string;      // stored in users.country
  label: string;
  currency: string;  // stored in users.currency
}

// Jordan first (default), then the rest.
export const COUNTRIES: CountryOption[] = [
  { code: "JO",    label: "Jordan",       currency: "JOD" },
  { code: "AE",    label: "UAE",          currency: "AED" },
  { code: "SA",    label: "Saudi Arabia", currency: "SAR" },
  { code: "KW",    label: "Kuwait",       currency: "KWD" },
  { code: "QA",    label: "Qatar",        currency: "QAR" },
  { code: "BH",    label: "Bahrain",      currency: "BHD" },
  { code: "OM",    label: "Oman",         currency: "OMR" },
  { code: "EG",    label: "Egypt",        currency: "EGP" },
  { code: "OTHER", label: "Other",        currency: "USD" },
];

export const DEFAULT_COUNTRY  = "JO";
export const DEFAULT_CURRENCY = "JOD";

/** Map a country code to its default currency (falls back to USD). */
export function currencyForCountry(country: string | null | undefined): string {
  return COUNTRIES.find(c => c.code === country)?.currency ?? DEFAULT_CURRENCY;
}

/**
 * Format a price with the business's currency.
 * e.g. formatPrice(15, "JOD")  → "JOD 15.00"
 *      formatPrice(150, "AED") → "AED 150.00"
 */
export function formatPrice(amount: number, currency: string | null | undefined): string {
  const cur = currency || DEFAULT_CURRENCY;
  const n = Number(amount);
  const num = (isNaN(n) ? 0 : n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cur} ${num}`;
}
