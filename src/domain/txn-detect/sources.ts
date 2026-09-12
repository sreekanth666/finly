/**
 * Who sent a message, as far as can be told without reading it.
 *
 * Indian SMS sender ids look like `VM-HDFCBK` or, since the 2025 TRAI change,
 * `JD-HDFCBK-S`: a two-letter operator prefix, a six-letter header that belongs
 * to the bank, and a suffix saying what kind of message it is. The header is the
 * stable part, so that is what is matched.
 *
 * A saved contact replaces the sender id in the notification title ("HDFC Bank"),
 * so the issuer is also looked for by name, in the title and then the body.
 *
 * The package lists double as the default allowlist the notification listener
 * is given: SMS apps, whose notifications carry bank SMS, and payment apps that
 * post their own alerts. Anything else a user wants read, they add themselves.
 */

import type { Channel } from './types';

type SenderHint = { issuer: string; isCard?: boolean };

/** Six-letter DLT headers, and the few shorter ones banks still use. */
const SENDER_HEADERS: Record<string, SenderHint> = {
  HDFCBK: { issuer: 'HDFC Bank' },
  HDFCCC: { issuer: 'HDFC Bank', isCard: true },
  ICICIB: { issuer: 'ICICI Bank' },
  ICICIT: { issuer: 'ICICI Bank' },
  SBIUPI: { issuer: 'SBI' },
  SBIINB: { issuer: 'SBI' },
  SBIPSG: { issuer: 'SBI' },
  CBSSBI: { issuer: 'SBI' },
  ATMSBI: { issuer: 'SBI' },
  SBICRD: { issuer: 'SBI Card', isCard: true },
  AXISBK: { issuer: 'Axis Bank' },
  KOTAKB: { issuer: 'Kotak Bank' },
  IDFCFB: { issuer: 'IDFC First Bank' },
  INDUSB: { issuer: 'IndusInd Bank' },
  YESBNK: { issuer: 'Yes Bank' },
  PNBSMS: { issuer: 'PNB' },
  BOBTXN: { issuer: 'Bank of Baroda' },
  BOBSMS: { issuer: 'Bank of Baroda' },
  CANBNK: { issuer: 'Canara Bank' },
  UNIONB: { issuer: 'Union Bank of India' },
  FEDBNK: { issuer: 'Federal Bank' },
  SIBSMS: { issuer: 'South Indian Bank' },
  AUBANK: { issuer: 'AU Small Finance Bank' },
  UTKSFB: { issuer: 'Utkarsh SFB' },
  UTKSPR: { issuer: 'Utkarsh SFB', isCard: true },
  EQUTAS: { issuer: 'Equitas SFB' },
  UJJIVN: { issuer: 'Ujjivan SFB' },
  PAYTMB: { issuer: 'Paytm Payments Bank' },
  AIRBNK: { issuer: 'Airtel Payments Bank' },
  AMEXIN: { issuer: 'American Express', isCard: true },
  ONECRD: { issuer: 'OneCard', isCard: true },
  SLICEP: { issuer: 'slice', isCard: true },
  CITIBK: { issuer: 'Citi' },
  SCBANK: { issuer: 'Standard Chartered' },
  HSBCIN: { issuer: 'HSBC' },
  RBLBNK: { issuer: 'RBL Bank' },
  IDBIBK: { issuer: 'IDBI Bank' },
  BDNBNK: { issuer: 'Bandhan Bank' },
  INDBNK: { issuer: 'Indian Bank' },
  IOBCHN: { issuer: 'Indian Overseas Bank' },
  CBOIMB: { issuer: 'Central Bank of India' },
  UCOBNK: { issuer: 'UCO Bank' },
  BOIIND: { issuer: 'Bank of India' },
  KBLBNK: { issuer: 'Karnataka Bank' },
  KVBANK: { issuer: 'Karur Vysya Bank' },
  CUBANK: { issuer: 'City Union Bank' },
  DBSBNK: { issuer: 'DBS Bank' },
  JUPITR: { issuer: 'Jupiter' },
  FIMONY: { issuer: 'Fi' },
};

/**
 * Issuer names as they appear in a message body or a contact name, longest
 * first so "SBI Card" is not reported as "SBI" and "Indian Overseas Bank" is not
 * reported as "Indian Bank".
 */
const ISSUER_NAMES: readonly [RegExp, string][] = [
  [/\bindian overseas bank\b/i, 'Indian Overseas Bank'],
  [/\bcentral bank of india\b/i, 'Central Bank of India'],
  [/\bunion bank of india\b|\bunion bank\b/i, 'Union Bank of India'],
  [/\bbank of baroda\b/i, 'Bank of Baroda'],
  [/\bbank of india\b/i, 'Bank of India'],
  [/\bsouth indian bank\b/i, 'South Indian Bank'],
  [/\bau small finance bank\b|\bau bank\b/i, 'AU Small Finance Bank'],
  [/\butkarsh\b/i, 'Utkarsh SFB'],
  [/\bequitas\b/i, 'Equitas SFB'],
  [/\bujjivan\b/i, 'Ujjivan SFB'],
  [/\bpaytm payments bank\b/i, 'Paytm Payments Bank'],
  [/\bairtel payments bank\b/i, 'Airtel Payments Bank'],
  [/\bsbi card\b|\bsbi credit card\b/i, 'SBI Card'],
  [/\bamerican express\b|\bamex\b/i, 'American Express'],
  [/\bidfc first\b|\bidfc\b/i, 'IDFC First Bank'],
  [/\bindusind\b/i, 'IndusInd Bank'],
  [/\bhdfc\b/i, 'HDFC Bank'],
  [/\bicici\b/i, 'ICICI Bank'],
  [/\baxis bank\b/i, 'Axis Bank'],
  [/\bkotak\b/i, 'Kotak Bank'],
  [/\byes bank\b/i, 'Yes Bank'],
  [/\bpnb\b|\bpunjab national bank\b/i, 'PNB'],
  [/\bcanara bank\b/i, 'Canara Bank'],
  [/\bfederal bank\b/i, 'Federal Bank'],
  [/\bindian bank\b/i, 'Indian Bank'],
  [/\buco bank\b/i, 'UCO Bank'],
  [/\bidbi\b/i, 'IDBI Bank'],
  [/\brbl bank\b/i, 'RBL Bank'],
  [/\bbandhan bank\b/i, 'Bandhan Bank'],
  [/\bkarnataka bank\b/i, 'Karnataka Bank'],
  [/\bkarur vysya\b/i, 'Karur Vysya Bank'],
  [/\bcity union bank\b/i, 'City Union Bank'],
  [/\bstandard chartered\b/i, 'Standard Chartered'],
  [/\bhsbc\b/i, 'HSBC'],
  [/\bciti(?:bank)?\b/i, 'Citi'],
  [/\bdbs\b/i, 'DBS Bank'],
  [/\bonecard\b/i, 'OneCard'],
  [/\bslice\b/i, 'slice'],
  [/\bsbi\b|\bstate bank\b/i, 'SBI'],
];

export type AppHint = { name: string; channel: Channel | null };

/** Apps whose notifications are bank SMS. Their content still has to pass the gate. */
export const SMS_APP_PACKAGES: readonly string[] = [
  'com.google.android.apps.messaging',
  'com.samsung.android.messaging',
  'com.android.mms',
  'com.android.messaging',
  'com.oneplus.mms',
  'com.motorola.messaging',
  'com.truecaller',
];

/**
 * Payment and banking apps that post an alert of their own for each payment.
 * Only package names that are certain are listed; the settings screen lets the
 * user add any other app they see a payment notification from.
 */
export const PAYMENT_APPS: Readonly<Record<string, AppHint>> = {
  'com.google.android.apps.nbu.paisa.user': { name: 'Google Pay', channel: 'upi' },
  'com.phonepe.app': { name: 'PhonePe', channel: 'upi' },
  'net.one97.paytm': { name: 'Paytm', channel: 'upi' },
  'in.org.npci.upiapp': { name: 'BHIM', channel: 'upi' },
  'com.dreamplug.androidapp': { name: 'CRED', channel: null },
  'in.amazon.mShop.android.shopping': { name: 'Amazon', channel: null },
  'com.mobikwik_new': { name: 'MobiKwik', channel: 'upi' },
  'com.csam.icici.bank.imobile': { name: 'ICICI iMobile', channel: null },
  'com.snapwork.hdfc': { name: 'HDFC Bank', channel: null },
  'com.sbi.lotusintouch': { name: 'YONO SBI', channel: null },
  'com.axis.mobile': { name: 'Axis Mobile', channel: null },
  'com.msf.kbank.mobile': { name: 'Kotak Bank', channel: null },
};

export const isSmsApp = (packageName: string | null | undefined): boolean =>
  packageName != null && SMS_APP_PACKAGES.includes(packageName);

export const appHint = (packageName: string | null | undefined): AppHint | null =>
  packageName == null ? null : (PAYMENT_APPS[packageName] ?? null);

/** `JD-HDFCBK-S` → `HDFCBK`. Null when it does not look like a sender id. */
export function senderHeader(sender: string | null | undefined): string | null {
  if (sender == null) return null;
  const match = /^(?:[A-Z]{2}-)?([A-Z0-9]{6})(?:-[A-Z])?$/i.exec(sender.trim());
  return match === null ? null : match[1].toUpperCase();
}

export function senderHint(sender: string | null | undefined): SenderHint | null {
  const header = senderHeader(sender);
  return header === null ? null : (SENDER_HEADERS[header] ?? null);
}

/** The issuer a piece of free text names, or null. */
export function issuerNamedIn(text: string | null | undefined): string | null {
  if (text == null || text.trim() === '') return null;
  for (const [pattern, issuer] of ISSUER_NAMES) {
    if (pattern.test(text)) return issuer;
  }
  return null;
}

/**
 * Sender id first, because it cannot be spoofed by the text; then a saved
 * contact name in the title; then the body.
 */
export function resolveIssuer(input: {
  sender?: string | null;
  title?: string | null;
  body: string;
}): string | null {
  return (
    senderHint(input.sender)?.issuer ??
    senderHint(input.title)?.issuer ??
    issuerNamedIn(input.title) ??
    issuerNamedIn(input.body)
  );
}
