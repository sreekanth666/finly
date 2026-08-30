/**
 * Category catalog.
 *
 * Design-pass stand-in for the `categories` table (see §5 of the MVP plan),
 * which stores a lucide icon name and a `color_token` per row. Holding the icon
 * component and the token directly keeps the design pass free of a
 * name-to-component registry; when the table lands, this file becomes the seed.
 *
 * `tone` is an `AppColor`, so a category can never carry a raw color literal.
 *
 * Every category here is seeded, which §5 marks `is_system` — archivable but
 * never deletable, so nothing can be removed out from under an expense that
 * references it. There is no delete anywhere in the UI for the same reason.
 *
 * There is no Income category: D4 keeps the MVP to expenses and settlements, and
 * `CHECK (amount_minor > 0)` leaves nowhere to put a negative one.
 */

import {
  Car,
  Ellipsis,
  HeartPulse,
  House,
  Lightbulb,
  ShoppingBag,
  UtensilsCrossed,
  User,
  type LucideIcon,
} from 'lucide-react-native';

import type { AppColor } from '@/theme';

export type CategoryId =
  | 'shopping'
  | 'bills'
  | 'housing'
  | 'food'
  | 'transport'
  | 'health'
  | 'personal'
  | 'other';

export type Category = {
  label: string;
  icon: LucideIcon;
  /** Theme token the icon is painted with — mirrors `categories.color_token`. */
  tone: AppColor;
  sortOrder: number;
  isArchived: boolean;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  shopping: { label: 'Shopping', icon: ShoppingBag, tone: 'foreground', sortOrder: 0, isArchived: false },
  bills: { label: 'Bills', icon: Lightbulb, tone: 'warning', sortOrder: 1, isArchived: false },
  housing: { label: 'Housing', icon: House, tone: 'iris', sortOrder: 2, isArchived: false },
  food: { label: 'Food', icon: UtensilsCrossed, tone: 'accent', sortOrder: 3, isArchived: false },
  transport: { label: 'Transport', icon: Car, tone: 'foreground', sortOrder: 4, isArchived: false },
  health: { label: 'Health', icon: HeartPulse, tone: 'danger', sortOrder: 5, isArchived: false },
  personal: { label: 'Personal', icon: User, tone: 'muted', sortOrder: 6, isArchived: false },
  other: { label: 'Other', icon: Ellipsis, tone: 'muted', sortOrder: 7, isArchived: false },
};
