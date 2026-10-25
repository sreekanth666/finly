/**
 * The icons a category may be given, in words.
 *
 * The picker used to cycle through bare Lucide names one tap at a time, so the
 * only way to find "the one for rent" was to tap until it appeared. A label and
 * a handful of keywords per icon let the picker be searched, and let a name
 * typed into the form suggest its own icon. Names only — the glyphs are mapped
 * in components/icon-registry.ts, which the type below keeps in step with this.
 *
 * Order is the order the picker shows: the seeded categories' icons first,
 * since they are what most people reach for, and the neutral one last.
 */

export const CATEGORY_ICONS = [
  {
    name: 'UtensilsCrossed',
    label: 'Food & dining',
    keywords: [
      'food', 'dining', 'restaurant', 'restaurants', 'eating', 'lunch', 'dinner', 'breakfast',
      'coffee', 'cafe', 'tea', 'chai', 'snacks', 'swiggy', 'zomato', 'takeaway',
    ],
  },
  {
    name: 'ShoppingBasket',
    label: 'Groceries',
    keywords: ['groceries', 'grocery', 'supermarket', 'vegetables', 'fruits', 'milk', 'kirana', 'blinkit', 'zepto', 'bigbasket'],
  },
  {
    name: 'Car',
    label: 'Transport',
    keywords: [
      'transport', 'commute', 'car', 'cab', 'taxi', 'uber', 'ola', 'auto', 'rapido',
      'fuel', 'petrol', 'diesel', 'parking', 'toll', 'metro', 'bus', 'train',
    ],
  },
  {
    name: 'Lightbulb',
    label: 'Bills & utilities',
    keywords: ['bills', 'bill', 'utilities', 'electricity', 'power', 'water', 'gas', 'lpg'],
  },
  {
    name: 'ShoppingBag',
    label: 'Shopping',
    keywords: ['shopping', 'clothes', 'clothing', 'fashion', 'shoes', 'amazon', 'flipkart', 'myntra'],
  },
  {
    name: 'HeartPulse',
    label: 'Health',
    keywords: ['health', 'medical', 'medicine', 'pharmacy', 'doctor', 'hospital', 'fitness', 'gym', 'insurance'],
  },
  {
    name: 'House',
    label: 'Housing',
    keywords: ['housing', 'house', 'home', 'rent', 'maintenance', 'society', 'furniture'],
  },
  {
    name: 'User',
    label: 'Personal',
    keywords: ['personal', 'self', 'care', 'salon', 'haircut', 'grooming', 'beauty'],
  },
  {
    name: 'Popcorn',
    label: 'Entertainment',
    keywords: ['entertainment', 'movies', 'movie', 'cinema', 'netflix', 'ott', 'streaming', 'games', 'fun', 'subscriptions'],
  },
  {
    name: 'Plane',
    label: 'Travel',
    keywords: ['travel', 'trips', 'trip', 'holiday', 'vacation', 'flights', 'flight', 'hotel', 'hotels'],
  },
  {
    name: 'Smartphone',
    label: 'Phone & internet',
    keywords: ['phone', 'mobile', 'recharge', 'internet', 'wifi', 'broadband', 'data', 'gadgets'],
  },
  {
    name: 'GraduationCap',
    label: 'Education',
    keywords: ['education', 'school', 'college', 'fees', 'tuition', 'books', 'courses', 'course', 'kids'],
  },
  {
    name: 'Gift',
    label: 'Gifts',
    keywords: ['gifts', 'gift', 'presents', 'birthday', 'wedding', 'donation', 'donations', 'charity'],
  },
  {
    name: 'PawPrint',
    label: 'Pets',
    keywords: ['pets', 'pet', 'dog', 'cat', 'vet'],
  },
  {
    name: 'Wrench',
    label: 'Repairs',
    keywords: ['repairs', 'repair', 'service', 'servicing', 'plumber', 'electrician'],
  },
  {
    name: 'Landmark',
    label: 'Loans & taxes',
    keywords: ['loans', 'loan', 'emi', 'tax', 'taxes', 'bank', 'interest', 'mortgage'],
  },
  {
    name: 'CreditCard',
    label: 'Card fees',
    keywords: ['card', 'cards', 'charges', 'annual', 'late'],
  },
  {
    name: 'Wallet',
    label: 'Savings',
    keywords: ['savings', 'saving', 'investments', 'investment', 'sip', 'mutual', 'funds'],
  },
  {
    name: 'Banknote',
    label: 'Cash',
    keywords: ['cash', 'atm', 'withdrawal', 'money', 'tips'],
  },
  {
    name: 'Ellipsis',
    label: 'Other',
    keywords: ['other', 'misc', 'miscellaneous', 'general'],
  },
] as const satisfies readonly { name: string; label: string; keywords: readonly string[] }[];

export type CategoryIconName = (typeof CATEGORY_ICONS)[number]['name'];

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** The neutral icon, for a category nothing else describes. */
export const FALLBACK_ICON_NAME: CategoryIconName = 'Ellipsis';

const normalise = (text: string) => text.trim().toLowerCase();

/**
 * The icons matching `query`, best first; all of them, in order, for a blank one.
 *
 * A label that starts with the query beats a keyword that does, which beats
 * the query turning up anywhere — so "re" puts Repairs above Housing (rent).
 */
export function searchIcons(query: string): CategoryIconName[] {
  const wanted = normalise(query);
  if (wanted.length === 0) return CATEGORY_ICONS.map((icon) => icon.name);

  const rank = (icon: CategoryIcon): number => {
    const label = icon.label.toLowerCase();
    if (label.startsWith(wanted)) return 0;
    if (icon.keywords.some((keyword) => keyword.startsWith(wanted))) return 1;
    if (label.includes(wanted) || icon.keywords.some((keyword) => keyword.includes(wanted))) return 2;
    return 3;
  };

  return CATEGORY_ICONS.map((icon) => ({ name: icon.name, rank: rank(icon) }))
    .filter((entry) => entry.rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.name);
}

/**
 * The icon a category called `name` most likely wants, or null.
 *
 * Whole words only: "Bus" names a bus, but "Business" must not pick the car.
 * The first word that any icon claims decides, so "Coffee & snacks" is food.
 */
export function suggestIcon(name: string): CategoryIconName | null {
  const words = normalise(name).split(/[^a-z0-9]+/).filter((word) => word.length > 0);

  for (const word of words) {
    const match = CATEGORY_ICONS.find((icon) =>
      (icon.keywords as readonly string[]).includes(word),
    );
    if (match !== undefined) return match.name;
  }

  return null;
}

/** The label a picker shows and a screen reader says for `name`. */
export const iconLabel = (name: string): string =>
  CATEGORY_ICONS.find((icon) => icon.name === name)?.label ?? 'Other';
