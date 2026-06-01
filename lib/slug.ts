export function slugifyBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip diacritics
    .replace(/[''`]/g, "")             // remove apostrophes
    .replace(/[^a-z0-9\s-]/g, "")     // remove special chars
    .trim()
    .replace(/\s+/g, "-")             // spaces → hyphens
    .replace(/-+/g, "-");             // collapse multiple hyphens
}

export function bookingUrl(businessName: string, base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"): string {
  return `${base}/book/${encodeURIComponent(businessName.toLowerCase())}`;
}