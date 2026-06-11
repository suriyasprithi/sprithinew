// Mobile numbers are exactly 10 digits everywhere in the app. `cleanMobile`
// normalises any raw input — strips non-digits and drops a country code by
// keeping the last 10 digits (so "+91 98765 43210" → "9876543210").
export function cleanMobile(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** True when the value is a valid 10-digit mobile number. */
export function isMobile(value: string): boolean {
  return /^\d{10}$/.test(value);
}
