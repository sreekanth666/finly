/**
 * A payment alert's shape, with everything personal taken out (D19).
 *
 * When a user reports that detection went wrong, the developer needs to see
 * how the bank *writes* its alerts — where the amount sits, which verb it
 * uses, how it writes the date — and nothing about the user. Masking is not
 * enough for that: it leaves names inside UPI narrations and every amount. A
 * skeleton keeps only the words the reader itself looks for:
 *
 * - detection words stay as they are: verbs, prepositions, a/c, ref, balance,
 *   UPI, gate words (OTP, statement, due), currency marks;
 * - a bank's name stays only as a whole name ("South Indian Bank"), never as a
 *   word that a shop could share ("SOUTH INDIAN SWEETS");
 * - every other word, in any script, becomes its case shape: `Aa`, `AA`, `aa`;
 * - an amount becomes `9` or `9.99` behind its currency mark;
 * - any other run of digits becomes 9s of the same length, so a twelve-digit
 *   reference still looks like one;
 * - dates and times stay, because a date the reader got wrong cannot be
 *   reproduced without them. The report preview says so.
 *
 * The test that keeps this honest: every message in the corpus reads as the
 * same kind, in the same direction, from its skeleton as from itself.
 */

const KEEP = new Set(
  [
    // Money verbs and their abbreviations.
    'debited', 'credited', 'debit', 'credit', 'spent', 'paid', 'sent', 'received', 'withdrawn', 'deducted',
    'charged', 'purchase', 'used', 'txn', 'transaction', 'trf', 'transferred', 'transfer', 'payment', 'refunded',
    'refund', 'reversed', 'reversal', 'added', 'dr', 'cr', 'deposited', 'chargeback', 'successful', 'success',
    'successfully', 'moved',
    // The words around them.
    'a', 'an', 'the', 'to', 'from', 'at', 'on', 'for', 'by', 'via', 'with', 'in', 'of', 'is', 'has', 'have', 'been',
    'was', 'will', 'be', 'your', 'ur', 'you', 'not', 'if', 'u', 'call', 'sms', 'block', 'dear', 'customer', 'user',
    'towards', 'thru', 'through', 'info', 'infor', 'date', 'and', 'as', 'it', 'this', 'we', 've', 'our', 'using',
    'details', 'check', 'app', 'thank', 'thanks', 'alert', 'great', 'news', 'dispute', 'report', 'done', 'here',
    'click', 'link', 'raise', 'initiated', 'end', 'now', 'or', 'any', 'more', 'amount', 'amt', 'value', 'beneficiary',
    'https', 'http',
    // Accounts, cards and balances.
    'c', 'ac', 'acct', 'account', 'card', 'cards', 'debitcard', 'creditcard', 'supercard', 'onecard', 'wallet',
    'balance', 'bal', 'avl', 'avail', 'aval', 'avbl', 'avlbl', 'avlbal', 'available', 'limit', 'lmt', 'new',
    'updated', 'total', 'tot', 'curr', 'current', 'closing', 'opening', 'savings', 'ending', 'no', 'number', 'id',
    'loan', 'emi', 'cust', 'x', 'xx',
    // References and rails.
    'ref', 'refno', 'rrn', 'utr', 'upi', 'vpa', 'neft', 'imps', 'rtgs', 'atm', 'pos', 'autopay', 'mandate', 'nach',
    'ecs', 'p2m', 'p2a', 'mob', 'bk', 'netbanking',
    // Currencies.
    'rs', 'inr', 'usd', 'eur', 'gbp', 'aed', 'sgd', 'aud', 'cad', 'rupees',
    // What the classifier gates on.
    'otp', 'password', 'code', 'verification', 'statement', 'due', 'tad', 'mad', 'minimum', 'min', 'overdue',
    'pay', 'by', 'late', 'avoid', 'generated', 'bill', 'failed', 'declined', 'unsuccessful', 'rejected',
    'insufficient', 'funds', 'upcoming', 'scheduled', 'requested', 'request', 'collect', 'cashback', 'offer',
    'upto', 'up', 'win', 'won', 'voucher', 'coupon', 'discount', 'eligible', 'apply', 'download', 'hurry',
    'congratulations', 'interest', 'earned', 'charges', 'charge', 'chgs', 'fee', 'fees', 'penalty', 'maintenance',
    'non', 'amb', 'annual', 'processing', 'wdl', 'sip', 'mutual', 'fund', 'clearing', 'corp', 'cred',
    'billdesk', 'top', 'topup', 'recharge', 'self', 'sensitive', 'notification', 'content', 'hidden',
    // Time words. Month and weekday names are kept only inside a date (see
    // PROTECTED): on their own, "May" and "August" are also people.
    'am', 'pm', 'ist', 'st', 'nd', 'rd', 'th',
    // Issuers and apps that are not also ordinary words or names. Anything that
    // is — "South", "Union", "India", "Amazon", "Bhim" — is kept only as part of
    // a whole bank name; see ISSUER_PHRASES.
    'bank', 'hdfc', 'hdfcbk', 'icici', 'sbi', 'axis', 'kotak', 'idfc', 'indusind', 'pnb', 'canara', 'sfb', 'sfbl',
    'utkarsh', 'equitas', 'ujjivan', 'paytm', 'amex', 'hsbc', 'rbl', 'idbi', 'bandhan', 'dbs', 'sbm', 'juspay',
    'apay', 'phonepe', 'gpay', 'millennia', 'uco',
  ].map((word) => word.toLowerCase()),
);

/**
 * Whole bank and clearing-house names, kept as they are. Their words alone are
 * too ordinary to keep — "SOUTH INDIAN SWEETS" is somebody's shop — so only the
 * full name survives, and a payee that merely shares a word with one does not.
 */
const ISSUER_PHRASES =
  /\b(?:state bank of india|union bank of india|central bank of india|bank of baroda|bank of india|punjab national bank|south indian bank|indian overseas bank|indian bank|idfc first bank|idfc first|yes bank|au small finance bank|au bank|american express|airtel payments bank|paytm payments bank|federal bank|karnataka bank|karur vysya bank|city union bank|canara bank|axis bank|hdfc bank|icici bank|kotak mahindra bank|kotak bank|sbm bank india|sbm bank|utkarsh sfbl?|amazon pay|google pay|indian clearing(?: corp\w*)?)\b/gi;

/**
 * Letters outside plain English. A name saved in Tamil, Malayalam, Hindi or any
 * other script is still a name. Spelled as ranges rather than `\p{L}` so it
 * does not depend on the JavaScript engine's Unicode property support.
 */
const OTHER_LETTERS =
  /[\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u06FF\u0900-\u0DFF\u0E00-\u0E7F\u1E00-\u1EFF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+/g;

const PROTECTED = new RegExp(
  [
    '\\b\\d{4}([-/:])\\d{2}\\1\\d{2}', // 2026-06-05, 2026:05:28
    '\\b\\d{1,2}[-/.]\\d{1,2}[-/.](?:\\d{4}|\\d{2})\\b', // 10-09-26, 10/09/2026
    '\\b\\d{1,2}(?:st|nd|rd|th)?[\\s\\-/]?[A-Za-z]{3,9}[\\s\\-/,]*\\d{2,4}\\b(?=[^:\\d]|$)', // 02-Sep-26, 10Sep26
    '\\b\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\b', // 02 Sep
    '\\b[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4}\\b', // March 28, 2026
    '\\b\\d{1,2}:\\d{2}(?::\\d{2})?', // 18:11:09
  ].join('|'),
  'g',
);

const MONTHS = new Set([
  'jan', 'january', 'feb', 'february', 'mar', 'march', 'apr', 'april', 'may', 'jun', 'june', 'jul', 'july',
  'aug', 'august', 'sep', 'sept', 'september', 'oct', 'october', 'nov', 'november', 'dec', 'december',
]);

/** A protected span with letters in it is a date only if every word is a month or an ordinal. */
const isDateSpan = (value: string): boolean =>
  (value.match(/[A-Za-z]+/g) ?? []).every(
    (word) => MONTHS.has(word.toLowerCase()) || /^(?:st|nd|rd|th)$/i.test(word),
  );

/** Word shapes: `Rahul` → `Aa`, `MENON` → `AA`, `okaxis` → `aa`, `K` → `A`. */
function shapeOf(word: string): string {
  if (KEEP.has(word.toLowerCase())) return word;
  if (/^x+$/i.test(word)) return word;
  if (word.length === 1) return /[A-Z]/.test(word) ? 'A' : 'a';
  if (word === word.toUpperCase()) return 'AA';
  if (word[0] === word[0].toUpperCase()) return 'Aa';
  return 'aa';
}

/** The parts of a message that are not dates or times. */
function skeletonOfPlain(text: string): string {
  return (
    text
      // Web links say nothing about a format and may carry a user's token.
      .replace(/\bhttps?:\/\/\S+/gi, 'https://…')
      // An amount behind its mark: the mark stays, the figure goes.
      .replace(/(₹|\bRs\.?|\bINR\.?|\bUSD|\bEUR|\bGBP|\bAED)(\s*:?\s*)(\d[\d,]*)(\.\d+)?/gi, (_, mark: string, gap: string, __, fraction?: string) =>
        `${mark}${gap}${fraction === undefined ? '9' : '9.99'}`,
      )
      // A bare figure with paise.
      .replace(/\b\d[\d,]*\.\d{1,2}\b/g, '9.99')
      // Every other run of digits keeps its length.
      .replace(/\d+/g, (digits) => '9'.repeat(digits.length))
      // A name in any other script.
      .replace(OTHER_LETTERS, 'Aa')
      // Words, by shape unless the reader looks for them.
      .replace(/[A-Za-z]+/g, shapeOf)
  );
}

/** The parts of a message outside a bank name: dates and times kept, the rest shaped. */
function skeletonOfUnnamed(body: string): string {
  let result = '';
  let last = 0;
  for (const match of body.matchAll(PROTECTED)) {
    const value = match[0];
    /* "02 Sep" is a date; "02 Rahul" is not, and must not survive as one. */
    if (!isDateSpan(value)) continue;
    result += skeletonOfPlain(body.slice(last, match.index)) + value;
    last = match.index + value.length;
  }
  return result + skeletonOfPlain(body.slice(last));
}

export function skeletonOf(body: string): string {
  let result = '';
  let last = 0;
  for (const match of body.matchAll(ISSUER_PHRASES)) {
    result += skeletonOfUnnamed(body.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return result + skeletonOfUnnamed(body.slice(last));
}
