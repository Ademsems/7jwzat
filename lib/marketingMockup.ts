/**
 * COSMETIC marketing only — representative round prices for the hero booking
 * mockup, per currency. NOT currency conversion and NOT tied to any real
 * business or the product's per-business currency logic.
 *
 * Tuple = [haircut & styling price, manicure price].
 */
export const MOCK_PRICES: Record<string, [number, number]> = {
  JOD: [15, 8],
  AED: [80, 45],
  SAR: [80, 45],
  KWD: [6, 3],
  QAR: [80, 45],
  BHD: [8, 4],
  OMR: [8, 4],
  EGP: [300, 150],
  USD: [20, 12],
};

/** Arabic short currency word for the mockup line; English uses the code. */
const CURRENCY_WORD_AR: Record<string, string> = {
  JOD: "دينار",
  AED: "درهم",
  SAR: "ريال",
  KWD: "دينار",
  QAR: "ريال",
  BHD: "دينار",
  OMR: "ريال",
  EGP: "جنيه",
  USD: "دولار",
};

/** Representative prices for a currency, falling back to JOD. */
export function mockPrices(currency: string): [number, number] {
  return MOCK_PRICES[currency] ?? MOCK_PRICES.JOD;
}

/** "15 دينار" (ar) or "15 JOD" (en). */
export function mockPriceLabel(amount: number, currency: string, locale: "ar" | "en"): string {
  if (locale === "ar") {
    return `${amount} ${CURRENCY_WORD_AR[currency] ?? currency}`;
  }
  return `${amount} ${currency}`;
}
