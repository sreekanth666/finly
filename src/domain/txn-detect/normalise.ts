/**
 * One spelling for everything the patterns care about.
 *
 * Banks write the rupee as ₹, Rs, Rs., Rs:, INR and INR. — sometimes glued to the
 * digits. Every pattern downstream looks for exactly `INR 123.45`, which is
 * what this produces. A currency word is only rewritten when a figure follows
 * it, so "RS Traders" keeps its name.
 *
 * Line breaks survive: several banks put one field per line, and the line is
 * the only thing that separates a payee from the date under it.
 */

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

export const CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'] as const;

export function normaliseText(raw: string): string {
  const text = raw
    .replace(ZERO_WIDTH, '')
    .replace(/\r\n?/g, '\n')
    .replace(/₹\s*/g, ' INR ')
    .replace(/\bRs\.?\s*:?\s*(?=\d)/gi, ' INR ')
    .replace(/\bRupees\s*(?=\d)/gi, ' INR ')
    .replace(/\bINR\.?\s*:?\s*(?=\d)/gi, 'INR ')
    .replace(/\$\s*(?=\d)/g, ' USD ')
    .replace(/\b(USD|EUR|GBP|AED|SGD|AUD|CAD)\.?\s*:?\s*(?=\d)/g, '$1 ');

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\u00A0]+/g, ' ').trim())
    .join('\n')
    .trim();
}

/** Collapses a name the way a person would compare it: case and spacing ignored. */
export const foldName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * What Android puts in place of a notification it has decided is too sensitive
 * for a third-party listener (Android 15+). Localised, so this is the English
 * form plus the shape every translation shares: short, and no digits at all.
 */
export function isRedacted(body: string): boolean {
  const text = body.trim().toLowerCase();
  if (text.includes('sensitive notification content hidden')) return true;
  if (text.includes('content hidden')) return true;
  return false;
}
