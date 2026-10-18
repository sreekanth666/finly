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

export const FALLBACK_ICON_NAME = 'Ellipsis';

const ICONS: Record<string, LucideIcon> = {
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

/** Every name a category may be given, for the icon picker in Settings. */
export const ICON_NAMES = Object.keys(ICONS).sort();

export const iconFor = (name: string | null | undefined): LucideIcon =>
  (name === null || name === undefined ? undefined : ICONS[name]) ?? Ellipsis;
