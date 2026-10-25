/**
 * Lucide icons, by name.
 *
 * The `categories` table stores an icon *name* (§5) — it cannot store a React
 * component — so something has to turn `'UtensilsCrossed'` back into a glyph.
 * That is this file. It is deliberately an explicit map rather than a dynamic
 * lookup into lucide-react-native: a lookup by name would have to bundle every
 * icon in the library to render a dozen. The glyphs themselves come from
 * ./icons, which imports them one file at a time.
 *
 * The names, labels and search keywords live in domain/category-icons.ts. The
 * map is keyed by that list's names, so an icon added there without a glyph
 * here — or the other way round — fails the typecheck.
 *
 * A name with no entry falls back to the neutral glyph rather than throwing. A
 * restored backup from a future version could name an icon this build has never
 * heard of, and that must not blank the screen.
 */

import {
  Banknote,
  Car,
  CreditCard,
  Ellipsis,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Lightbulb,
  PawPrint,
  Plane,
  Popcorn,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  UtensilsCrossed,
  User,
  Wallet,
  Wrench,
  type LucideIcon,
} from '@/components/icons';
import { CATEGORY_ICONS, type CategoryIconName } from '@/domain/category-icons';

export { FALLBACK_ICON_NAME } from '@/domain/category-icons';

const ICONS: Record<CategoryIconName, LucideIcon> = {
  Banknote,
  Car,
  CreditCard,
  Ellipsis,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Lightbulb,
  PawPrint,
  Plane,
  Popcorn,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  UtensilsCrossed,
  User,
  Wallet,
  Wrench,
};

/** Every name a category may be given, in the order the picker shows them. */
export const ICON_NAMES: readonly CategoryIconName[] = CATEGORY_ICONS.map((icon) => icon.name);

export const iconFor = (name: string | null | undefined): LucideIcon =>
  (name === null || name === undefined
    ? undefined
    : (ICONS as Partial<Record<string, LucideIcon>>)[name]) ?? Ellipsis;
