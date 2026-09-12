/**
 * A starting guess at a category from a payee's name, for the first time a
 * payee is seen.
 *
 * Deliberately small and deliberately second: the user's own rules are asked
 * first, and choosing a category on the confirm screen can turn into a rule.
 * This only has to be right often enough to save a tap on day one. Names are
 * the seeded categories' names and are resolved to ids by name at the call
 * site, so a renamed or archived category simply gets no suggestion.
 */

const MERCHANT_CATEGORIES: readonly [RegExp, string][] = [
  [
    /\b(?:swiggy|zomato|domino'?s|pizza hut|kfc|mcdonald'?s?|burger king|starbucks|chai|cafe|caf[eé]|restaurant|bakery|dhaba|eatsure|box8|faasos|haldiram'?s?|barbeque|biryani)\b/i,
    'Food',
  ],
  [
    /\b(?:blinkit|zepto|bigbasket|big basket|instamart|dmart|d mart|jiomart|reliance fresh|spencer'?s?|grofers|big bazaar|supermarket|kirana|milkbasket|country delight|more retail)\b/i,
    'Groceries',
  ],
  [
    /\b(?:uber|ola|rapido|irctc|metro|ksrtc|redbus|makemytrip|goibibo|indigo|air india|akasa|spicejet|fastag|petrol|fuel|hpcl|bpcl|indian oil|iocl|parking|namma yatri|blusmart)\b/i,
    'Transport',
  ],
  [
    /\b(?:jio|airtel|vodafone|bsnl|act fibernet|tata play|dish tv|electricity|bescom|kseb|tneb|msedcl|tata power|bses|indane|bharat gas|hp gas|broadband|recharge|lic|insurance|netflix|spotify|hotstar|prime video|youtube premium)\b/i,
    'Bills',
  ],
  [
    /\b(?:amazon|flipkart|myntra|ajio|meesho|nykaa|tata cliq|croma|reliance digital|decathlon|ikea|lenskart|snapdeal|shoppers stop|westside|zara|uniqlo)\b/i,
    'Shopping',
  ],
  [
    /\b(?:apollo|pharmeasy|netmeds|1mg|medplus|hospital|clinic|pharmacy|chemist|diagnostics?|practo|healthkart)\b/i,
    'Health',
  ],
  [/\b(?:rent|nobroker|nestaway|society maintenance)\b/i, 'Housing'],
  [/\b(?:salon|spa|barber|urban company|bookmyshow|pvr|inox|gym|cult\.?fit)\b/i, 'Personal'],
];

/** The seeded category name a payee's name suggests, or null. */
export function categoryNameFor(...names: (string | null | undefined)[]): string | null {
  for (const name of names) {
    if (name == null || name.trim() === '') continue;
    const subject = name.replace(/@.*$/, '').replace(/[._-]+/g, ' ');
    for (const [pattern, category] of MERCHANT_CATEGORIES) {
      if (pattern.test(subject)) return category;
    }
  }
  return null;
}
